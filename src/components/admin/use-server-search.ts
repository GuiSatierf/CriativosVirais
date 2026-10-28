"use client";
import { useEffect, useRef, useState } from "react";
import { toastError } from "@/lib/client";

const searchDelayMs = 300;

/**
 * Keeps the list the server rendered until the search changes, then asks the server again after a
 * pause. `search` is the query string of the request ("" for the unfiltered list); `load` must be a
 * stable function, defined outside the component.
 */
export function useServerSearch<T>(initial: T, search: string, load: (search: string) => Promise<T>) {
  const [list, setList] = useState(initial);
  const [source, setSource] = useState(initial);
  // router.refresh() brings a new server list; it replaces the table unless a search is showing.
  if (source !== initial) {
    setSource(initial);
    if (search.length === 0) setList(initial);
  }
  const searched = useRef(false);
  useEffect(() => {
    // The server already rendered the unfiltered list.
    if (!searched.current && search.length === 0) return;
    searched.current = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await load(search);
        if (!controller.signal.aborted) setList(result);
      } catch (error) {
        if (!controller.signal.aborted) toastError(error);
      }
    }, search.length === 0 ? 0 : searchDelayMs);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [search, load]);
  return list;
}
