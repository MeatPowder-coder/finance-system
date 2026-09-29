import HomePage from "../../web/app/page";
import ChatPage from "../../web/app/chat/page";
import AppLayout from "../../web/components/AppLayout";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function App() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light", "theme-light");
    return () => {
      document.documentElement.classList.remove("light", "theme-light");
    };
  }, []);

  const page = pathname === "/chat" ? <ChatPage /> : <HomePage />;

  return <AppLayout>{page}</AppLayout>;
}
