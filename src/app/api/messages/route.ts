import { NextRequest, NextResponse } from "next/server";
import { getMessages, saveMessages, getNextMessageId, Message } from "@/lib/store";

// GET /api/messages — return all messages
export async function GET() {
  const messages = await getMessages();
  return NextResponse.json({ messages });
}

// POST /api/messages — add a new message
export async function POST(req: NextRequest) {
  const body = await req.json();
  const messages = await getMessages();
  const newMsg: Message = {
    id: await getNextMessageId(),
    sender: body.sender || "Manny",
    text: body.text || "",
    time: new Date().toISOString(),
  };
  messages.push(newMsg);
  await saveMessages(messages);
  return NextResponse.json({ success: true, message: newMsg });
}
