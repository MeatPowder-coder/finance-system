import HomePage from "../../web/app/page";
import ChatPage from "../../web/app/chat/page";
import AppLayout from "../../web/components/AppLayout";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function App() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, []);

  const page = pathname === "/chat" ? <ChatPage /> : <HomePage />;

  return <AppLayout>{page}</AppLayout>;
}
