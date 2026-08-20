import { useState } from 'react';
import Home from "@/pages/Home";
import { LoginPage } from "@/components/LoginPage";
import { isAuthenticated } from "@/lib/auth";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isAuthenticated());

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  return <Home />;
}
