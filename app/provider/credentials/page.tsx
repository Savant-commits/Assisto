import { redirect } from "next/navigation";

export default function ProviderCredentialsRedirect() {
  redirect("/apply#credentials");
}
