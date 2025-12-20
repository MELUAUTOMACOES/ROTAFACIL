export async function buscarEnderecoPorCep(cep: string) {
  const cleanCep = cep.replace(/\D/g, '');
  // Use our backend proxy to avoid CORS
  const url = `/api/cep/${cleanCep}`;
  const res = await fetch(url);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Erro ao buscar CEP");
  }

  const data = await res.json();
  // Backend proxy already checks for data.erro but good to keep safe checks
  if (data.erro) throw new Error("CEP não encontrado");

  return data; // {logradouro, bairro, localidade, uf, ...}
}