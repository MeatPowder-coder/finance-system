import HomePage from "../../web/app/page";
import ChatPage from "../../web/app/chat/page";
import AppLayout from "../../web/components/AppLayout";
import EntryGate from "../../web/components/EntryGate";
import { usePathname } from "next/navigation";

export function App() {
  const pathname = usePathname();

  const page = pathname === "/chat" ? <ChatPage /> : <HomePage />;

  return (
    <EntryGate>
      <AppLayout>{page}</AppLayout>
    </EntryGate>
  );
}
