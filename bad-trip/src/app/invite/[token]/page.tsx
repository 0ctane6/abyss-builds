import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { AcceptInvite } from "@/components/AcceptInvite";
import { createClient } from "@/lib/supabase/server";

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Il faut être connecté pour rejoindre : on renvoie vers l'inscription/connexion
  // en gardant le lien d'invitation comme destination.
  if (!user) {
    redirect(`/login?next=/invite/${params.token}`);
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-md px-4 py-16">
        <AcceptInvite token={params.token} />
      </main>
    </div>
  );
}
