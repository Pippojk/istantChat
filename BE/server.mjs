import express from "express";
import mongoose from "mongoose";
import Cors from "cors";
import MessageContentModel from "./model/dbMessages.mjs";
import loginContents from "./model/dbLog.mjs";
import bcrypt from "bcrypt";
import chatContent from "./model/dbChat.mjs";
import dotenv from "dotenv";
dotenv.config();
import jwt from 'jsonwebtoken';
import Pusher from "pusher";

// Middleware per verificare il token JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.sendStatus(401); // Se il token è mancante
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403); // Token non valido
    }
    req.user = user; // Aggiungi l'utente alla richiesta
    next(); // Passa alla prossima funzione
  });
};

const pusher = new Pusher({
});

const pusher2 = new Pusher({
});

const hashPassword = async (password) => {
  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
  } catch (error) {
    console.log(error);
  }
};

const createkey = async (name) => {
  try {
    const saltRounds = 1;
    let hashedPassword = await bcrypt.hash(name, saltRounds);
    hashedPassword = hashedPassword.slice(-4);
    return hashedPassword;
  } catch (error) {
    console.log(error);
  }
};

mongoose.set('strictQuery', false);

const app = express();
const port = process.env.PORT || 9000;

app.use(express.json());
app.use(Cors());

// Connessione al database
const connectionDbUrl = "connessioneDatabase";

mongoose.connect(connectionDbUrl, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const db = mongoose.connection;
db.once("open", function () {
  console.log("db connected");

  const msgCollection = db.collection("messagecontents");
  const changeStream = msgCollection.watch();

  changeStream.on("change", (change) => {
    if (change.operationType === "insert") {
      const record = change.fullDocument;
      pusher.trigger("messages", "inserted", {
        'name': record.name,
        'message': record.message
      });
    } else {
      console.log("not trigger pusher");
    }
  });

  const chtCollection = db.collection("chatcontents");
  const changeStreamm = chtCollection.watch();

  changeStreamm.on("change", (change) => {
    if (change.operationType === "insert") {
      const record2 = change.fullDocument;
      pusher2.trigger("channels", "inserted", {
        'name': record2.name,
      });
    } else {
      console.log("not trigger pusher");
    }
  });
});
db.on("error", function (error) {
  console.error("Errore nella connessione al database:", error);
});

app.get('/api', (req, res) => {
  res.status(200).send("Benvenuto sul Server");
});

app.post("/api/v1/messages", async (req, res) => {
  try {
    const dbMessage = req.body;
    const createdMessage = await MessageContentModel.create(dbMessage);
    res.status(201).send(createdMessage);
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

// Endpoint per creare un canale
app.post("/api/v1/canali", async (req, res) => {
  try {
    const { partecipanti, name } = req.body;
    const me = req.body.partecipanti[1];
    const you = partecipanti.find(p => p !== me);

    // Verifica che entrambi gli utenti esistano
    const user = await loginContents.findOne({ key: me });
    const user2 = await loginContents.findOne({ key: you });

    if (!user || !user2) {
      return res.status(404).send("Utente non trovato");
    }

    const dbMessages = {
      partecipanti: [me, you],
      name
    };

    const createdMessage = await chatContent.create(dbMessages);
    res.status(201).send(createdMessage);

  } catch (error) {
    console.error('Errore nella creazione del canale:', error);
    res.status(500).send(error);
  }
});

// Sincronizzazione dei messaggi
app.post('/api/v1/messages/sync', async (req, res) => {
  try {
    const { nameChat, key } = req.body; 

    const chat = await chatContent.findOne({ name: nameChat });

    if (!chat || !chat.partecipanti.includes(key)) {
      return res.status(403).send("Non hai accesso a questa chat");
    }

    const messages = await MessageContentModel.find({ chatName: nameChat });
    res.status(200).send(messages);

  } catch (error) {
    console.error('Errore nella sincronizzazione dei messaggi:', error);
    res.status(500).send(error);
  }
});

// Sincronizzazione dei canali
app.post('/api/v1/canali/sync', async (req, res) => {
  try {
    const userKey = req.body.key; // Estrai l'utente autenticato dal token
    const chats = await chatContent.find({ partecipanti: userKey }); // Trova solo le chat in cui l'utente è un partecipante
    res.status(200).send(chats);
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

// Registrazione nuovo utente
app.post("/api/v1/signup", async (req, res) => {
  try {
    const dblog = req.body;

    if (dblog.passwordConfirm === dblog.password) {
      dblog.password = await hashPassword(dblog.password);
      dblog.key = await createkey(dblog.key);
      const createdlog = await loginContents.create(dblog);
      res.status(201).send(createdlog);
    } else {
      res.status(400).json({
        message: "Le password non coincidono"
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

// Login utente
app.post("/api/v1/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await loginContents.findOne({ email });
    if (!user) {
      console.log('Utente non trovato:', email);
      return res.status(401).json({
        message: 'Credenziali non valide'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('Password non valida per utente:', email);
      return res.status(401).json({ message: 'Credenziali non valide' });
    }

    res.json({          
      username: user.username,  // Include the username
      key: user.key            // Include the key
    });

  } catch (error) {
    console.error('Errore durante il login:', error);
    res.status(500).send(error);
  }
});

// Avvio del server
app.listen(port, () => {
  console.log('Server avviato sulla porta: ' + port);
});