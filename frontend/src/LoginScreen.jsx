import React, { useState } from 'react';
import './LoginScreen.css';

export default function LoginScreen({ users, notice, onLogin, onRegister }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-badge">Orbital</div>
        <h1>NUS Timetable</h1>
        <p>Select a demo account or create a new blank account.</p>
        {notice ? <p className="login-notice">{notice}</p> : null}

        <div className="login-panels">
          <section className="login-panel">
            <div className="panel-heading">
              <h2>Demo accounts</h2>
              <p>Quickly switch into a preset timetable.</p>
            </div>

            <div className="login-user-list">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="login-user-button"
                  onClick={() => onLogin(user.id)}
                >
                  <span className="login-user-name">{user.name}</span>
                  <span className="login-user-email">{user.email}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="login-panel create-account-form">
            <div className="panel-heading">
              <h2>Create new account</h2>
              <p>Create a blank account and add it to the account list.</p>
            </div>

            <label>
              Name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="your@email.example"
              />
            </label>

            <button
              type="button"
              className="login-user-button create-account-button"
              onClick={() => onRegister(name, email)}
              disabled={!name.trim() || !email.trim()}
            >
              <span className="login-user-name">Create blank account</span>
              <span className="login-user-email">No timetable data yet</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}