import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProviderPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect("/login?redirect=/provider");

  const { data: provider } = await supabase
    .from("providers")
    .select("id")
    .eq("id", userData.user.id)
    .single();

  if (!provider) redirect("/");

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Provider tools</h1>
      <p className="mb-6 text-muted-foreground">Manage your provider account.</p>

      <div className="space-y-6">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-2 font-medium text-blue-900">Categories & services</h2>
          <p className="mb-4 text-sm text-blue-800">Manage which categories and services you offer so customers can find you for the right work.</p>
          <a href="/profile/services" className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Manage services
          </a>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-2 font-medium text-blue-900">Share your work</h2>
          <p className="mb-4 text-sm text-blue-800">Upload photos and videos of your past projects to showcase your work.</p>
          <a href="/profile/portfolio" className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Upload portfolio
          </a>
        </div>
      </div>
    </div>
  );
}
