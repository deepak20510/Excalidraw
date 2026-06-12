import axios from "axios";
import { BACKEND_URL } from "../../config";
import { ChatRoom as ChatRoomComponent } from "../../../components/ChatRoom";

async function getRoomId(slug: string) {
  const response = await axios.get(`${BACKEND_URL}/room/${slug}`);
  return response.data.room.id;
}

export default async function ChatRoom({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } = await params;
  try {
    const roomId = await getRoomId(slug);
    return <ChatRoomComponent id={String(roomId)} />;
  } catch (error) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        width: "100vw",
        fontFamily: "sans-serif"
      }}>
        <h2>Room Not Found</h2>
        <p>The room "{slug}" does not exist.</p>
        <a href="/" style={{
          padding: "8px 16px",
          backgroundColor: "#0070f3",
          color: "white",
          textDecoration: "none",
          borderRadius: "4px",
          marginTop: "10px"
        }}>Go Home</a>
      </div>
    );
  }
}
