import { NextRequest } from "next/server";
import { Liveblocks } from "@liveblocks/node";
import { auth } from "@clerk/nextjs/server";

const liveblocks = new Liveblocks({
  secret: "sk_dev_aaROPPAtRxb7vlidFoqD1xCJqUikBTTWv596lAQUM-8k0H9cslS-GKAgV_Pvelok",
});

export async function POST(request: NextRequest) {
  try {
    // Get the current user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Create a session for the current user
    const session = liveblocks.prepareSession(userId, {
      userInfo: {
        name: `User ${userId}`,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
      },
    });

    // Give the user access to the room
    const { room } = await request.json();
    if (room) {
      session.allow(room, session.FULL_ACCESS);
    }

    // Authorize the user and return the result
    const { status, body } = await session.authorize();
    return new Response(body, { status });
  } catch (error) {
    console.error("Liveblocks auth error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
