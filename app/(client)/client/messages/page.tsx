import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/display";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { MessageComposer } from "./composer";

export const metadata = { title: "Messages" };

export default async function ClientMessagesPage() {
  const user = await getCurrentUser();
  if (!user?.clientId) return <p className="text-sm text-slate-500">No client company linked.</p>;

  const messages = await prisma.message.findMany({
    where: { clientId: user.clientId },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        eyebrow="Support"
        title="Messages"
        description="Communicate directly with the laboratory about your samples."
        image="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=640&q=65&auto=format&fit=crop"
      />

      <Card>
        <CardHeader title="Conversation" subtitle={`${messages.length} message${messages.length === 1 ? "" : "s"}`} />
        <CardContent className="space-y-3">
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.fromClient ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                  m.fromClient ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"
                }`}>
                  <p>{m.body}</p>
                  <p className={`mt-1 text-[10px] ${m.fromClient ? "text-brand-200" : "text-slate-400"}`}>
                    {m.fromClient ? "You" : "Laboratory"}
                  </p>
                </div>
              </div>
            ))}
            {!messages.length ? (
              <p className="py-8 text-center text-xs text-slate-400">No messages yet — start the conversation below.</p>
            ) : null}
          </div>
          <MessageComposer />
        </CardContent>
      </Card>
    </div>
  );
}