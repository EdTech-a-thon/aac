# 02 — Symbol upload endpoint and public bucket

**What to build:** An authenticated User can send image bytes and get back the digest that identifies them. Bytes land in a public-read, service-role-write storage bucket keyed by that digest, so the digest alone is enough for anyone to fetch the image later. Uploading the same image twice is harmless and produces no duplicate.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] An authenticated User can upload image bytes and receive a digest
- [ ] An unauthenticated request is refused
- [ ] The endpoint takes no Vocabulary identifier — bytes are not Vocabulary data (ADR 0008)
- [ ] Uploading identical bytes twice returns the same digest and does not rewrite or duplicate the object
- [ ] PNG, JPEG, WebP and GIF are accepted, judged by sniffing magic bytes rather than the declared content type
- [ ] SVG is rejected
- [ ] A file whose declared type disagrees with its bytes is judged by its bytes
- [ ] Bytes over the 2 MB server cap are rejected
- [ ] Bytes are stored exactly as received — never re-encoded server-side (ADR 0008)
- [ ] Stored objects are served with long-lived cache headers, since bytes behind a digest can never change
