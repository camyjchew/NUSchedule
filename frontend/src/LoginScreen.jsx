import React from 'react';
import { MOCK_USERS } from './data/dummyData';
import './LoginScreen.css';

export default function LoginScreen({ onLogin }) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-badge">Orbital</div>
        <h1>NUS Timetable</h1>
        <p>Select your name to continue.</p>

        <div className="login-user-list">
          {MOCK_USERS.map((user) => (
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
      </div>
    </div>
  );
}