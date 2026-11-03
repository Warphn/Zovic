type Handler = (request: Request) => Promise<Response>;

/**
 * Tira a chave `token` das respostas JSON das rotas do Better Auth (sign-in, sign-up,
 * get-session, list-sessions…). O navegador autentica só pelo cookie httpOnly; o token no corpo
 * ficaria legível pelo JavaScript da página, e um XSS o roubaria (vira sessão se o plugin bearer
 * for ligado).
 *
 * Age só na borda HTTP: as chamadas internas (auth.api.getSession, e o próprio Better Auth ao
 * revogar sessões) continuam vendo o token. Um hook `after` do Better Auth não serve, porque
 * também roda nessas chamadas internas.
 *
 * Atenção ao ligar plugins que devolvem um token de propósito ao cliente (jwt, one-time-token):
 * esta função o removeria também.
 */
export function hideSessionTokens(handler: Handler): Handler {
  return async (request) => {
    const response = await handler(request);
    if (!response.headers.get("content-type")?.includes("application/json")) {
      return response;
    }

    const text = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return new Response(text, response);
    }

    // Set-Cookie e o status seguem iguais; só o tamanho do corpo muda.
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(JSON.stringify(withoutTokens(body)), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

function withoutTokens(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutTokens);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "token")
        .map(([key, item]) => [key, withoutTokens(item)]),
    );
  }
  return value;
}
