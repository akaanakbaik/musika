import React, { useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";

export function SearchBar() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setLocation(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
      <Input
        type="search"
        placeholder="What do you want to listen to?"
        className="w-full pl-10 pr-4 py-6 rounded-full bg-secondary/50 border-transparent focus-visible:ring-2 focus-visible:ring-white focus-visible:border-transparent text-base transition-colors hover:bg-secondary/80 focus:bg-secondary"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </form>
  );
}
