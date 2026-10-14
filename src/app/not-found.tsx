import Link from "next/link";
export default function NotFound() {
  return (
    <main className="p-10">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <Link className="mt-4 inline-block underline" href="/chat">
        Voltar ao início
      </Link>
    </main>
  );
}
