"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="p-8">
      <h2 className="text-xl font-semibold">
        Não foi possível carregar esta página.
      </h2>
      <p className="my-4 text-muted-foreground">
        Tente novamente em instantes.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
