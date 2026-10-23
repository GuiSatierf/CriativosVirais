"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  LoaderCircle,
  MessageSquare,
  Plus,
  RotateCcw,
  X,
} from "@/components/icons";
import { api, savedSchema, toastError } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type TextKey =
  | "produtoNome"
  | "produto"
  | "transformacao"
  | "mecanismo"
  | "publico"
  | "tipoFunil"
  | "proximoPassoFunil"
  | "especialistaHandle";
type ListKey = "provasAutorizadas" | "objecoes" | "restricoes";
type FieldKey = TextKey | ListKey | "price";

/** Context values the form edits; `ticketCents` is a bigint-safe string. */
export type ContextFormValues = Record<TextKey, string> &
  Record<ListKey, string[]> & { ticketCents: string | null };

type FormState = Record<TextKey | "price", string> & Record<ListKey, string[]>;
type Patch = Partial<Record<TextKey, string> & Record<ListKey, string[]>> & {
  ticketCents?: string | null;
};

type Field = {
  key: FieldKey;
  /** Asked as a plain question. */
  label: string;
  hint?: string;
  placeholder?: string;
  max: number;
  kind: "short" | "medium" | "long" | "price" | "list";
  /** One-click answers for common cases. */
  suggestions?: string[];
};

type Section = {
  id: string;
  title: string;
  description: string;
  fields: Field[];
};

/** The API accepts at most 30 items per list. */
const maxItems = 30;
const saveDelay = 800;

const sections: Section[] = [
  {
    id: "produto",
    title: "Seu produto",
    description: "O básico para o assistente saber o que você vende.",
    fields: [
      {
        key: "produtoNome",
        label: "Qual é o nome do produto?",
        hint: "Do jeito que o cliente conhece.",
        placeholder: "Ex.: Método Inglês em 90 Dias",
        max: 300,
        kind: "medium",
      },
      {
        key: "price",
        label: "Quanto custa?",
        hint: "Valor à vista, com vírgula para os centavos.",
        placeholder: "997,00",
        max: 20,
        kind: "price",
      },
      {
        key: "produto",
        label: "O que a pessoa recebe ao comprar?",
        hint: "Liste o que vem no pacote: aulas, bônus, suporte, garantia.",
        placeholder:
          "Ex.: Curso em vídeo com 40 aulas, grupo de dúvidas e garantia de 7 dias.",
        max: 4000,
        kind: "long",
      },
    ],
  },
  {
    id: "cliente",
    title: "Seu cliente",
    description: "Para quem os roteiros falam e o que essa pessoa quer.",
    fields: [
      {
        key: "publico",
        label: "Quem compra?",
        hint: "Idade, profissão, momento de vida. Quanto mais específico, melhor.",
        placeholder:
          "Ex.: Profissionais de 25 a 40 anos que precisam de inglês no trabalho.",
        max: 4000,
        kind: "long",
      },
      {
        key: "transformacao",
        label: "O que muda na vida da pessoa depois?",
        hint: "O resultado que ela quer alcançar com o produto.",
        placeholder:
          "Ex.: Conversar em inglês numa reunião de trabalho sem travar.",
        max: 4000,
        kind: "long",
      },
      {
        key: "objecoes",
        label: "O que faz a pessoa hesitar em comprar?",
        hint: "Toque numa sugestão ou escreva a sua.",
        placeholder: "Ex.: Já tentei outros cursos e desisti",
        max: 4000,
        kind: "list",
        suggestions: [
          "Não tenho tempo",
          "Está caro",
          "Não sei se funciona para mim",
          "Já tentei antes e não deu certo",
        ],
      },
    ],
  },
  {
    id: "venda",
    title: "Como você vende",
    description: "O que diferencia sua oferta e para onde o anúncio leva.",
    fields: [
      {
        key: "mecanismo",
        label: "O que torna seu método diferente?",
        hint: "O jeito próprio como o produto entrega o resultado.",
        placeholder:
          "Ex.: Aulas de 15 minutos com frases reais do trabalho, repetidas em voz alta.",
        max: 4000,
        kind: "long",
      },
      {
        key: "tipoFunil",
        label: "Para onde o anúncio leva?",
        hint: "Escolha uma opção ou escreva a sua.",
        placeholder: "Ex.: Página de vendas",
        max: 1000,
        kind: "medium",
        suggestions: [
          "Página de vendas",
          "WhatsApp",
          "Formulário de cadastro",
          "Aula ao vivo",
        ],
      },
      {
        key: "proximoPassoFunil",
        label: "O que a pessoa deve fazer depois do vídeo?",
        hint: "A ação que o anúncio pede no final.",
        placeholder: "Ex.: Clicar em Saiba mais",
        max: 1000,
        kind: "medium",
        suggestions: [
          "Clicar em Saiba mais",
          "Chamar no WhatsApp",
          "Fazer a inscrição",
          "Comprar agora",
        ],
      },
      {
        key: "especialistaHandle",
        label: "Perfil do especialista (opcional)",
        hint: "O @ de quem aparece nos vídeos, se houver.",
        placeholder: "@seuperfil",
        max: 100,
        kind: "short",
      },
    ],
  },
  {
    id: "regras",
    title: "Regras dos roteiros",
    description: "O que pode e o que não pode aparecer nos anúncios.",
    fields: [
      {
        key: "provasAutorizadas",
        label: "O que pode ser usado como prova?",
        hint: "Só resultados reais que você autoriza mostrar.",
        placeholder: "Ex.: Mais de 3.000 alunos",
        max: 4000,
        kind: "list",
      },
      {
        key: "restricoes",
        label: "O que os roteiros nunca devem dizer?",
        hint: "Toque numa sugestão ou escreva a sua.",
        placeholder: "Ex.: Não prometer fluência em prazo fixo",
        max: 4000,
        kind: "list",
        suggestions: [
          "Não prometer resultado garantido",
          "Não citar concorrentes",
          "Não falar em ganhos financeiros",
        ],
      },
    ],
  },
];

const listKeys: ListKey[] = ["provasAutorizadas", "objecoes", "restricoes"];

function isList(key: FieldKey): key is ListKey {
  return (listKeys as FieldKey[]).includes(key);
}

function centsToReais(cents: string | null) {
  if (!cents) return "";
  const padded = cents.padStart(3, "0");
  const whole = BigInt(padded.slice(0, -2)).toLocaleString("pt-BR");
  return `${whole},${padded.slice(-2)}`;
}

/** "997", "997,5", "1.997,00" or "R$ 997" → cents string; null if empty. */
function reaisToCents(input: string): string | null | undefined {
  const value = input.replace(/R\$|\s/g, "");
  if (!value) return null;
  const match = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(value);
  if (!match) return undefined;
  const cents = `${match[1].replaceAll(".", "")}${(match[2] ?? "").padEnd(2, "0")}`;
  const normalized = cents.replace(/^0+(?=\d)/, "");
  return normalized.length <= 15 ? normalized : undefined;
}

function toState(values: ContextFormValues): FormState {
  return {
    produtoNome: values.produtoNome,
    produto: values.produto,
    transformacao: values.transformacao,
    mecanismo: values.mecanismo,
    publico: values.publico,
    tipoFunil: values.tipoFunil,
    proximoPassoFunil: values.proximoPassoFunil,
    especialistaHandle: values.especialistaHandle,
    provasAutorizadas: values.provasAutorizadas,
    objecoes: values.objecoes,
    restricoes: values.restricoes,
    price: centsToReais(values.ticketCents),
  };
}

function filled(form: FormState, key: FieldKey) {
  const value = form[key];
  return Array.isArray(value) ? value.length > 0 : value.trim() !== "";
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Saves each change shortly after it happens, one request at a time. Failed
 * changes stay queued until the next edit or an explicit retry.
 */
function useAutosave() {
  const router = useRouter();
  const queued = useRef<Patch>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inFlight = useRef(false);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const pending = () =>
    inFlight.current || Object.keys(queued.current).length > 0;

  async function flush() {
    clearTimeout(timer.current);
    if (inFlight.current || !Object.keys(queued.current).length) return;
    const patch = queued.current;
    queued.current = {};
    inFlight.current = true;
    setStatus("saving");
    let ok = false;
    try {
      await api("/api/context", savedSchema, patch, "PATCH");
      ok = true;
      // The hero suggestions depend on the product name and offer.
      if ("produtoNome" in patch || "produto" in patch) router.refresh();
    } catch (error) {
      queued.current = { ...patch, ...queued.current };
      setStatus("error");
      toastError(error, "Não foi possível salvar. Tente novamente.");
    } finally {
      inFlight.current = false;
    }
    if (!ok) return;
    if (Object.keys(queued.current).length) void flush();
    else setStatus("saved");
  }

  function queue(patch: Patch, delay = saveDelay) {
    Object.assign(queued.current, patch);
    setStatus("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delay);
  }

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pending()) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return { status, queue, flush };
}

/** Where each question sits: its section and position inside it. */
const steps = sections.flatMap((section, sectionIndex) =>
  section.fields.map((field, index) => ({
    field,
    section,
    sectionIndex,
    index,
  })),
);

function fieldInputId(key: FieldKey) {
  return isList(key) ? `ctx-${key}-new` : `ctx-${key}`;
}

/** Shows an answer in one line for the summary. */
function preview(form: FormState, key: FieldKey) {
  const value = form[key];
  if (Array.isArray(value)) return value.join(" · ");
  return key === "price" && value ? `R$ ${value}` : value.trim();
}

/**
 * One question per screen, grouped in four short sections, ending in a
 * summary where every answer can be reopened. Answers save as they are typed.
 */
export function ContextForm({ initial }: { initial: ContextFormValues }) {
  const [form, setForm] = useState(() => toState(initial));
  const [priceError, setPriceError] = useState(false);
  // Resumes at the first unanswered question; the summary when all are done.
  const [step, setStep] = useState(() => {
    const state = toState(initial);
    const first = steps.findIndex(({ field }) => !filled(state, field.key));
    return first === -1 ? steps.length : first;
  });
  const { status, queue, flush } = useAutosave();
  const moved = useRef(false);

  const done = steps.filter(({ field }) => filled(form, field.key)).length;
  const total = steps.length;
  const current = steps[step];

  useEffect(() => {
    // Focus follows the step only after the user moves, not on page load.
    if (!moved.current) return;
    const target = current
      ? document.getElementById(fieldInputId(current.field.key))
      : document.getElementById("ctx-summary-title");
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [current]);

  function go(next: number) {
    void flush();
    moved.current = true;
    setPriceError(false);
    setStep(Math.max(0, Math.min(next, steps.length)));
  }

  function setText(key: TextKey, value: string) {
    setForm((state) => ({ ...state, [key]: value }));
    queue({ [key]: value });
  }

  function setPrice(value: string) {
    setForm((state) => ({ ...state, price: value }));
    const cents = reaisToCents(value);
    if (cents === undefined) return;
    setPriceError(false);
    queue({ ticketCents: cents });
  }

  function setList(key: ListKey, items: string[]) {
    setForm((state) => ({ ...state, [key]: items }));
    queue({ [key]: items }, 0);
  }

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      current?.field.key === "price" &&
      reaisToCents(form.price) === undefined
    ) {
      setPriceError(true);
      document.getElementById("ctx-price")?.focus();
      return;
    }
    go(step + 1);
  }

  const answered = current ? filled(form, current.field.key) : false;
  const last = step === steps.length - 1;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <ol aria-label="Etapas" className="grid grid-cols-4 gap-2">
        {sections.map((section, index) => {
          const fields = section.fields;
          const complete = fields.every((field) => filled(form, field.key));
          const active = current?.sectionIndex === index;
          const start = steps.findIndex((item) => item.sectionIndex === index);
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => go(start)}
                aria-current={active ? "step" : undefined}
                className="group flex w-full flex-col gap-2 rounded-lg pt-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/70"
              >
                <span
                  className={cn(
                    "h-1 w-full rounded-full bg-muted transition-colors duration-(--duration-fast)",
                    (active || complete) && "bg-primary",
                  )}
                />
                <span
                  className={cn(
                    "flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground",
                    active && "font-medium text-foreground",
                  )}
                >
                  {complete && (
                    <Check className="size-3.5 shrink-0" aria-hidden />
                  )}
                  <span className={cn("truncate", !active && "max-sm:sr-only")}>
                    {section.title}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {current ? (
        <form
          onSubmit={submit}
          className="space-y-6 rounded-2xl border bg-card p-5 sm:p-6"
        >
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>
              {current.section.title} · {current.index + 1} de{" "}
              {current.section.fields.length}
            </p>
            <SaveIndicator status={status} onRetry={() => void flush()} />
          </div>

          <FieldRow
            key={current.field.key}
            field={current.field}
            form={form}
            priceError={priceError}
            onText={setText}
            onPrice={setPrice}
            onPriceBlur={() =>
              setPriceError(reaisToCents(form.price) === undefined)
            }
            onList={setList}
            onBlur={() => void flush()}
          />

          <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:items-center">
            {step > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => go(step - 1)}
              >
                <ArrowLeft aria-hidden />
                Voltar
              </Button>
            )}
            <Button type="submit" size="lg" className="sm:ml-auto">
              {last ? "Ver resumo" : answered ? "Continuar" : "Pular por agora"}
              <ArrowRight aria-hidden />
            </Button>
          </div>
        </form>
      ) : (
        <section
          aria-labelledby="ctx-summary-title"
          className="space-y-6 rounded-2xl border bg-card p-5 sm:p-6"
        >
          <div className="space-y-2 text-center">
            <h2
              id="ctx-summary-title"
              tabIndex={-1}
              className="font-heading text-2xl font-semibold tracking-tight outline-none"
            >
              {done === total
                ? "Tudo pronto!"
                : `Faltam ${total - done} ${total - done === 1 ? "resposta" : "respostas"}`}
            </h2>
            <p className="text-sm text-muted-foreground">
              {done === total
                ? "O assistente já tem o que precisa para escrever seus roteiros."
                : "Você já pode usar o assistente. Quanto mais respostas, melhores os roteiros."}
            </p>
            <div className="flex justify-center pt-1">
              <SaveIndicator status={status} onRetry={() => void flush()} />
            </div>
          </div>
          {sections.map((section) => (
            <div key={section.id} className="space-y-1">
              <h3 className="px-1 text-xs font-medium text-muted-foreground">
                {section.title}
              </h3>
              <ul className="divide-y rounded-xl border">
                {section.fields.map((field) => {
                  const text = preview(form, field.key);
                  return (
                    <li key={field.key}>
                      <button
                        type="button"
                        onClick={() =>
                          go(
                            steps.findIndex(
                              (item) => item.field.key === field.key,
                            ),
                          )
                        }
                        className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors duration-(--duration-fast) first:rounded-t-xl last:rounded-b-xl hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/70"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            {field.label}
                          </span>
                          <span
                            className={cn(
                              "block truncate text-sm",
                              text ? "text-muted-foreground" : "text-warning",
                            )}
                          >
                            {text || "Sem resposta"}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm text-muted-foreground">
                          {text ? "Editar" : "Responder"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:items-center">
            <Button type="button" variant="ghost" onClick={() => go(0)}>
              <RotateCcw aria-hidden />
              Revisar do início
            </Button>
            <Link
              href="/chat"
              className={cn(buttonVariants({ size: "lg" }), "sm:ml-auto")}
            >
              <MessageSquare aria-hidden />
              Ir para a conversa
            </Link>
          </div>
        </section>
      )}

      {current && (
        <p className="text-center text-sm text-muted-foreground">
          Prefere falar?{" "}
          <Link
            href="/chat"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Responda na conversa
          </Link>{" "}
          e o assistente preenche para você.
        </p>
      )}
    </div>
  );
}

function SaveIndicator({
  status,
  onRetry,
}: {
  status: SaveStatus;
  onRetry: () => void;
}) {
  if (status === "error")
    return (
      <p role="status" className="flex items-center gap-2 text-sm">
        <CircleAlert className="size-4 text-destructive" aria-hidden />
        <span className="text-destructive">Não salvou</span>
        <Button type="button" variant="link" size="xs" onClick={onRetry}>
          <RotateCcw aria-hidden />
          Tentar de novo
        </Button>
      </p>
    );
  return (
    <p
      role="status"
      className="flex items-center gap-1.5 text-sm text-muted-foreground"
    >
      {status === "saving" ? (
        <>
          <LoaderCircle
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          Salvando…
        </>
      ) : status === "saved" ? (
        <>
          <Check className="size-4" aria-hidden />
          Salvo
        </>
      ) : (
        "Salva automaticamente"
      )}
    </p>
  );
}

function FieldRow({
  field,
  form,
  priceError,
  onText,
  onPrice,
  onPriceBlur,
  onList,
  onBlur,
}: {
  field: Field;
  form: FormState;
  priceError: boolean;
  onText: (key: TextKey, value: string) => void;
  onPrice: (value: string) => void;
  onPriceBlur: () => void;
  onList: (key: ListKey, items: string[]) => void;
  onBlur: () => void;
}) {
  const key = field.key;
  const id = `ctx-${key}`;
  const hintId = `${id}-hint`;
  const invalid = key === "price" && priceError;
  const describedBy =
    [field.hint ? hintId : undefined, invalid ? `${id}-error` : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  let control: React.ReactNode;
  if (isList(key)) {
    control = (
      <ListEditor
        id={id}
        label={field.label}
        items={form[key]}
        placeholder={field.placeholder}
        max={field.max}
        suggestions={field.suggestions}
        describedBy={describedBy}
        onItems={(items) => onList(key, items)}
      />
    );
  } else if (key === "price") {
    control = (
      <div className="relative w-44">
        <span
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
          aria-hidden
        >
          R$
        </span>
        <Input
          id={id}
          name={key}
          value={form.price}
          placeholder={field.placeholder}
          maxLength={field.max}
          inputMode="decimal"
          autoComplete="off"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className="pl-9 tabular-nums"
          onChange={(event) => onPrice(event.target.value)}
          onBlur={() => {
            onPriceBlur();
            onBlur();
          }}
        />
      </div>
    );
  } else {
    const common = {
      id,
      name: key,
      value: form[key],
      placeholder: field.placeholder,
      maxLength: field.max,
      "aria-describedby": describedBy,
      onBlur,
    };
    control =
      field.kind === "long" ? (
        <Textarea
          {...common}
          rows={3}
          className="min-h-24"
          onChange={(event) => onText(key, event.target.value)}
        />
      ) : (
        <Input
          {...common}
          autoComplete="off"
          className={field.kind === "short" ? "max-w-60" : undefined}
          onChange={(event) => onText(key, event.target.value)}
        />
      );
  }

  const textKey = !isList(key) && key !== "price" ? key : undefined;
  const choices = textKey
    ? field.suggestions?.filter((choice) => choice !== form[textKey])
    : undefined;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label
          htmlFor={isList(key) ? `${id}-new` : id}
          className="font-heading text-xl font-semibold tracking-tight text-balance sm:text-2xl"
        >
          {field.label}
        </Label>
        {field.hint && (
          <p id={hintId} className="text-sm text-muted-foreground">
            {field.hint}
          </p>
        )}
      </div>
      {control}
      {textKey && choices && choices.length > 0 && (
        <Suggestions
          label={`Sugestões para: ${field.label}`}
          items={choices}
          onPick={(choice) => onText(textKey, choice)}
        />
      )}
      {invalid && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          Use só números, com vírgula para os centavos. Ex.: 1.997,00
        </p>
      )}
    </div>
  );
}

function Suggestions({
  label,
  items,
  onPick,
}: {
  label: string;
  items: string[];
  onPick: (item: string) => void;
}) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item}>
          <button
            type="button"
            onClick={() => onPick(item)}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg border px-3 text-sm text-muted-foreground transition-colors duration-(--duration-fast) outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/70 pointer-coarse:min-h-10"
          >
            <Plus className="size-3.5" aria-hidden />
            {item}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Items as removable chips; Enter or "Adicionar" appends what was typed. */
function ListEditor({
  id,
  label,
  items,
  placeholder,
  max,
  suggestions,
  describedBy,
  onItems,
}: {
  id: string;
  label: string;
  items: string[];
  placeholder?: string;
  max: number;
  suggestions?: string[];
  describedBy: string | undefined;
  onItems: (items: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const full = items.length >= maxItems;
  const remaining = suggestions?.filter((item) => !items.includes(item));

  function append(value: string) {
    const item = value.trim();
    if (!item || full) return;
    if (!items.includes(item)) onItems([...items, item]);
  }

  function add() {
    append(draft);
    setDraft("");
    inputRef.current?.focus();
  }

  function remove(index: number) {
    onItems(items.filter((_, i) => i !== index));
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <ul aria-label={label} className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <li
              key={`${index}-${item}`}
              className="flex max-w-full items-center gap-1 rounded-2xl bg-muted py-1 pr-1 pl-3 text-sm"
            >
              <span className="min-w-0 break-words">{item}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="shrink-0 rounded-lg text-muted-foreground"
                aria-label={`Remover: ${item}`}
                onClick={() => remove(index)}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          id={`${id}-new`}
          value={draft}
          placeholder={full ? "Limite de itens atingido" : placeholder}
          maxLength={max}
          disabled={full}
          autoComplete="off"
          aria-describedby={describedBy}
          enterKeyHint="done"
          onChange={(event) => setDraft(event.target.value)}
          // Keeps a typed item instead of losing it when focus moves away.
          onBlur={() => {
            append(draft);
            setDraft("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={full || draft.trim() === ""}
          onClick={add}
        >
          <Plus aria-hidden />
          Adicionar
        </Button>
      </div>
      {remaining && remaining.length > 0 && !full && (
        <Suggestions
          label={`Sugestões para: ${label}`}
          items={remaining}
          onPick={append}
        />
      )}
    </div>
  );
}
