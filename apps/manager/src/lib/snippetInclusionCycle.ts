/** True if placing Snippet `snippetId` on `hostId` would make a Snippet include itself. */
export function wouldCreateSnippetInclusionCycle(
	inclusions: { host_id: string; snippet_id: string }[],
	hostId: string,
	snippetId: string
): boolean {
	if (hostId === snippetId) return true;
	const includedByHost = new Map<string, string[]>();
	for (const inclusion of inclusions) {
		const next = includedByHost.get(inclusion.host_id) ?? [];
		next.push(inclusion.snippet_id);
		includedByHost.set(inclusion.host_id, next);
	}
	const seen = new Set<string>();
	const stack = [snippetId];
	while (stack.length > 0) {
		const current = stack.pop()!;
		if (current === hostId) return true;
		if (seen.has(current)) continue;
		seen.add(current);
		for (const next of includedByHost.get(current) ?? []) {
			stack.push(next);
		}
	}
	return false;
}
