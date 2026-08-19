import { useState, useEffect } from 'react';
import Home from "@/pages/Home";
import { LoginPage, isAuthenticated } from "@/components/LoginPage";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isAuthenticated());

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  return <Home />;
}
