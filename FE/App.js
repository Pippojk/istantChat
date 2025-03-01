import React, { useEffect, useState } from 'react';
import './App.css';
import Sidebar from './sidebar/Sidebar';
import Login from './logjn/Login';
import Chat from './chat/Chat';
import SignUp from './signUp/SignUp';
import Schermatainiziale from './schermataIniziale/SchermataIniziale';
import Pusher from 'pusher-js';

import axios from './axios';

function App() {
  const [chat, setChat] = useState(false);
  const [iniziale, setIniziale] = useState(true);
  const [login, setLogin] = useState(false);
  const [signup, setSignup] = useState(false);

  const [name, setName] = useState("");
  const [key, setKey] = useState("");

  const [messages, setMessages] = useState([]);
  const [canali, setCanali] = useState([]);

  const [currentChat, setCurrentChat] = useState("");
  const change = (nuovoStato) => {
    setChat(false);
    setLogin(false);
    setIniziale(false);
    setSignup(false);
    
    if (nuovoStato === 'chat') {
      setChat(true);
    } else if (nuovoStato === 'login') {
      setLogin(true);
    } else if (nuovoStato === 'signup') {
      setSignup(true);
    } else {
      setIniziale(true);
    }
  };

  
  

  useEffect(() => {
    var pusher = new Pusher('', {
    });
    
    var channel = pusher.subscribe('messages');
    channel.bind('inserted', (newMessage) => {
      // Utilizza una funzione di aggiornamento dello stato per garantire una corretta gestione dell'aggiornamento
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    });
  
    return () => {
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (key) {
      change('chat');  // Naviga alla chat solo dopo che la key è aggiornata
    }
  }, [key]);
 
  useEffect(() => {
    var pusher = new Pusher('', {
    });

    var channel = pusher.subscribe('channels');
    channel.bind('inserted', function(newMessage){
      setCanali((prevMessages) => [...prevMessages, newMessage]);
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
    }
  }, []);

  return (
    <div className="app">
      <div className="app_body">
        {iniziale && <Schermatainiziale updateLog={change} />}
        {login && <Login updateLog={change} setUserName={setName} setkey={setKey}/>}
        {chat && <Sidebar userName={name} chats={canali} keyy={key} newCurrentChat={setCurrentChat}  newCanali={setCanali} loggato={chat}/>}
        {(chat && currentChat != "")  && <Chat messages={messages} userName={name} currentchat={currentChat} newMessages={setMessages}/>}
        
        {signup && <SignUp updateLog={change}/>}
      </div>
    </div>
  );
}

export default App;
