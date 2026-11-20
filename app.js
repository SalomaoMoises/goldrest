/* ==========================================================
   GOLDREST - FRONTEND LIGADO À API
   API: http://localhost:3000/api
   Não utiliza localStorage para dados operacionais.
========================================================== */

const API_BASE = (window.GOLDREST_API_URL || "http://localhost:3000/api").replace(/\/$/, "");
const TOKEN_KEY = "goldrest_token";
const USER_KEY = "utilizadorLogado";
let produtosCache = [], mesasCache = [], pedidosCache = [], vendasCache = [], funcionariosCache = [], stockCache = [], movimentosCache = [];
let itensPedidoAtual = [], definicoesCache = {};

const $ = (id) => document.getElementById(id);
const valor = (id) => $(id)?.value?.trim() ?? "";
const mostrar = (id, texto) => { if ($(id)) $(id).textContent = texto ?? ""; };
const formatarKz = (n) => (Number(n) || 0).toLocaleString("pt-AO", {minimumFractionDigits:2, maximumFractionDigits:2}) + " Kz";
const utilizadorLogado = () => { try { return JSON.parse(sessionStorage.getItem(USER_KEY) || "null"); } catch { return null; } };
function guardarUtilizador(u, token) { sessionStorage.setItem(USER_KEY, JSON.stringify(u)); sessionStorage.setItem(TOKEN_KEY, token); }
function obterToken() { return sessionStorage.getItem(TOKEN_KEY); }
function lerObjetoDados(chave) { if (chave === "definicoesRestaurante") { try { return JSON.parse(sessionStorage.getItem("goldrest_definicoes") || "{}"); } catch { return {}; } } return {}; }
function guardarObjetoDados(chave, dados) { if (chave === "definicoesRestaurante") { sessionStorage.setItem("goldrest_definicoes", JSON.stringify(dados)); return true; } return false; }
function escapar(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function celula(tr, texto) { const td=document.createElement("td"); td.textContent=texto ?? ""; tr.appendChild(td); return td; }
function botaoAcao(rotulo, acao, id, classe="") { const b=document.createElement("button"); b.type="button"; b.textContent=rotulo; b.dataset.acao=acao; b.dataset.id=id; if(classe)b.className=classe; return b; }

async function api(caminho, opcoes={}) {
  const headers = {...(opcoes.headers || {})};
  if (!(opcoes.body instanceof FormData) && opcoes.body !== undefined) headers["Content-Type"]="application/json";
  if (obterToken()) headers.Authorization = `Bearer ${obterToken()}`;
  let resposta;
  try { resposta=await fetch(`${API_BASE}${caminho}`, {...opcoes, headers}); }
  catch { throw new Error(`Não foi possível contactar a API em ${API_BASE}. Confirma se o servidor está ligado.`); }
  const tipo=resposta.headers.get("content-type") || "";
  const dados=tipo.includes("application/json") ? await resposta.json() : await resposta.text();
  if (resposta.status===401 && !location.pathname.toLowerCase().endsWith("index.html") && !location.pathname.toLowerCase().endsWith("cadastrar.html")) {
    terminarSessao(); throw new Error("A sessão expirou. Inicia sessão novamente.");
  }
  if(!resposta.ok) throw new Error((dados && (dados.erro || dados.mensagem)) || (typeof dados === "string" ? dados : "O pedido não foi concluído."));
  return dados;
}
async function lerImagem(file) { if(!file) return ""; if(file.size>1024*1024) throw new Error("A imagem deve ter no máximo 1 MB."); return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error("Não foi possível ler a imagem."));r.readAsDataURL(file);}); }
function atualizarIdentidade() {
  const d=definicoesCache||{}; const nome=d.nome||"GOLDREST";
  document.querySelectorAll("#nomeRestauranteMenu, #nomeRestaurantePainel").forEach(e=>e.textContent=nome);
  document.querySelectorAll("#rodapeRestaurante, #rodapeRestaurantePainel").forEach(e=>e.textContent=nome+" - Sistema de Gestão de Restaurante");
  document.querySelectorAll("#logoRestauranteMenu, #logoPainel").forEach(img=>{if(d.logo){img.src=d.logo;img.hidden=false;img.style.display="";} });
  if($("nomeUtilizador")) mostrar("nomeUtilizador",utilizadorLogado()?.nome||"Administrador");
}
function terminarSessao(redirecionar=true) { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(USER_KEY); sessionStorage.removeItem("goldrest_definicoes"); if(redirecionar) location.href="index.html"; }
window.terminarSessao=terminarSessao;

async function carregarDefinicoes() { try { definicoesCache=await api("/definicoes"); guardarObjetoDados("definicoesRestaurante",definicoesCache); atualizarIdentidade(); } catch(e) { console.warn("Definições:",e.message); } }
function protegerPagina() {
  const paginaPublica = !!$("formLogin") || !!$("formCadastro");
  if(!paginaPublica && !obterToken()) { location.replace("index.html"); return false; }
  return true;
}

// AUTENTICAÇÃO E REGISTO
if($("formCadastro")) $("formCadastro").addEventListener("submit", async e=>{
  e.preventDefault(); const senha=valor("senha"), confirmar=valor("confirmarSenha");
  if(senha!==confirmar){alert("As palavras-passe não coincidem.");return;}
  if(senha.length<6){alert("A palavra-passe deve ter pelo menos 6 caracteres.");return;}
  try { await api("/registar",{method:"POST",body:JSON.stringify({nome:valor("nome"),email:valor("email").toLowerCase(),telefone:valor("telefone"),senha})}); alert("Conta criada com sucesso. Inicia sessão."); location.href="index.html"; }
  catch(err){alert(err.message);}
});
if($("formLogin")) $("formLogin").addEventListener("submit", async e=>{
  e.preventDefault(); const btn=$("formLogin").querySelector('[type="submit"]'); if(btn)btn.disabled=true;
  try { const r=await api("/login",{method:"POST",body:JSON.stringify({email:valor("emailLogin").toLowerCase(),senha:valor("senhaLogin")})}); guardarUtilizador(r.utilizador,r.token); location.href="menu.html"; }
  catch(err){alert(err.message);} finally {if(btn)btn.disabled=false;}
});

// PRODUTOS
async function carregarProdutos(){produtosCache=await api("/produtos"); if(!Array.isArray(produtosCache))produtosCache=[]; renderProdutos(); preencherProdutosSelects();}
function preencherProdutosSelects(){["produtoPedido","produtoStock"].forEach(id=>{const s=$(id);if(!s)return;const primeiro=s.options[0]?.text||"Selecionar produto";s.innerHTML="";s.add(new Option(primeiro,""));produtosCache.forEach(p=>s.add(new Option(`${p.nome} — ${formatarKz(p.preco)} (Stock: ${p.quantidade})`,p.id)));});}
function renderProdutos(){const tb=$("listaProdutos");if(!tb)return;tb.innerHTML="";const q=valor("pesquisaProduto").toLowerCase();const lista=produtosCache.filter(p=>(p.nome+" "+p.categoria).toLowerCase().includes(q));lista.forEach(p=>{const tr=document.createElement("tr");const img=celula(tr,"");if(p.imagem){const el=document.createElement("img");el.src=p.imagem;el.alt=p.nome;el.style.cssText="width:48px;height:48px;object-fit:cover;border-radius:8px";img.appendChild(el);}celula(tr,p.nome);celula(tr,p.categoria);celula(tr,formatarKz(p.preco));celula(tr,p.quantidade);const a=celula(tr,"");a.append(botaoAcao("Editar","editar-produto",p.id),botaoAcao("Eliminar","eliminar-produto",p.id));tb.appendChild(tr);});mostrar("quantidadeRegistos",`${lista.length} produto(s) registado(s)`);if($("mensagemSemProdutos"))$("mensagemSemProdutos").hidden=lista.length>0;}
function limparFormProduto(){["produtoId","nomeProduto","categoriaProduto","precoProduto","quantidadeProduto","descricaoProduto"].forEach(id=>{if($(id))$(id).value="";});if($("imagemProduto"))$("imagemProduto").value="";if($("previsualizacaoImagem"))$("previsualizacaoImagem").hidden=true;if($("botaoCancelar"))$("botaoCancelar").hidden=true;}
if($("formProduto")){
 $("imagemProduto")?.addEventListener("change",async()=>{try{const data=await lerImagem($("imagemProduto").files[0]);if(data){$("previsualizacaoImagem").src=data;$("previsualizacaoImagem").hidden=false;}}catch(e){alert(e.message);}});
 $("botaoCancelar")?.addEventListener("click",limparFormProduto);
 $("formProduto").addEventListener("submit",async e=>{e.preventDefault();try{const id=valor("produtoId");let imagem="";if($("imagemProduto")?.files[0])imagem=await lerImagem($("imagemProduto").files[0]);else if(id)imagem=produtosCache.find(p=>p.id===id)?.imagem||"";const body={nome:valor("nomeProduto"),categoria:valor("categoriaProduto"),preco:Number(valor("precoProduto")),quantidade:Number(valor("quantidadeProduto")),descricao:valor("descricaoProduto"),imagem};await api(id?`/produtos/${encodeURIComponent(id)}`:"/produtos",{method:id?"PUT":"POST",body:JSON.stringify(body)});alert("Produto guardado com sucesso.");limparFormProduto();await carregarProdutos();}catch(err){alert(err.message);}});
 $("pesquisaProduto")?.addEventListener("input",renderProdutos);
 $("listaProdutos")?.addEventListener("click",async e=>{const b=e.target.closest("button[data-acao]");if(!b)return;const p=produtosCache.find(x=>x.id===b.dataset.id);if(!p)return;if(b.dataset.acao==="editar-produto"){["produtoId","nomeProduto","categoriaProduto","precoProduto","quantidadeProduto","descricaoProduto"].forEach((id,i)=>$(id).value=[p.id,p.nome,p.categoria,p.preco,p.quantidade,p.descricao||""][i]);if(p.imagem){$("previsualizacaoImagem").src=p.imagem;$("previsualizacaoImagem").hidden=false;}$("botaoCancelar").hidden=false;window.scrollTo({top:0,behavior:"smooth"});}else if(confirm(`Eliminar o produto ${p.nome}?`)){try{await api(`/produtos/${encodeURIComponent(p.id)}`,{method:"DELETE"});await carregarProdutos();}catch(err){alert(err.message);}}});
}

// MESAS
async function carregarMesas(){mesasCache=await api("/mesas");if(!Array.isArray(mesasCache))mesasCache=[];renderMesas();preencherMesasPedido();}
function renderMesas(){const tb=$("listaMesas");if(!tb)return;tb.innerHTML="";const q=valor("pesquisaMesa").toLowerCase();const lista=mesasCache.filter(m=>String(m.numero).includes(q));lista.forEach(m=>{const tr=document.createElement("tr");celula(tr,m.numero);celula(tr,m.capacidade);celula(tr,m.estado);const a=celula(tr,"");a.append(botaoAcao("Editar","editar-mesa",m.id),botaoAcao("Eliminar","eliminar-mesa",m.id));tb.appendChild(tr);});mostrar("totalMesas",mesasCache.length);mostrar("mesasLivres",mesasCache.filter(m=>m.estado==="Livre").length);mostrar("mesasOcupadas",mesasCache.filter(m=>m.estado==="Ocupada").length);if($("mensagemMesas"))$("mensagemMesas").hidden=mesasCache.length>0;}
function preencherMesasPedido(){const s=$("mesaPedido");if(!s)return;s.innerHTML="";s.add(new Option("Escolha uma mesa livre",""));mesasCache.filter(m=>m.estado==="Livre").forEach(m=>s.add(new Option(`Mesa ${m.numero} (${m.capacidade} lugares)`,m.id)));}
function limparFormMesa(){["idMesa","numeroMesa","capacidadeMesa"].forEach(id=>$(id).value="");$("estadoMesa").value="Livre";$("botaoCancelarMesa").hidden=true;mostrar("tituloFormularioMesa","Cadastrar Mesa");}
if($("formMesa")){
 $("formMesa").addEventListener("submit",async e=>{e.preventDefault();const id=valor("idMesa");try{await api(id?`/mesas/${encodeURIComponent(id)}`:"/mesas",{method:id?"PUT":"POST",body:JSON.stringify({numero:Number(valor("numeroMesa")),capacidade:Number(valor("capacidadeMesa")),estado:valor("estadoMesa")})});limparFormMesa();await carregarMesas();}catch(err){alert(err.message);}});
 $("botaoCancelarMesa")?.addEventListener("click",limparFormMesa);$("pesquisaMesa")?.addEventListener("input",renderMesas);
 $("listaMesas")?.addEventListener("click",async e=>{const b=e.target.closest("button[data-acao]");if(!b)return;const m=mesasCache.find(x=>x.id===b.dataset.id);if(!m)return;if(b.dataset.acao==="editar-mesa"){["idMesa","numeroMesa","capacidadeMesa","estadoMesa"].forEach((id,i)=>$(id).value=[m.id,m.numero,m.capacidade,m.estado][i]);$("botaoCancelarMesa").hidden=false;mostrar("tituloFormularioMesa","Editar Mesa");}else if(confirm(`Eliminar a mesa ${m.numero}?`)){try{await api(`/mesas/${encodeURIComponent(m.id)}`,{method:"DELETE"});await carregarMesas();}catch(err){alert(err.message);}}});
}

// PEDIDOS
function renderItensPedido(){const tb=$("itensPedido");if(!tb)return;tb.innerHTML="";let total=0;itensPedidoAtual.forEach((it,i)=>{const sub=it.preco*it.quantidade;total+=sub;const tr=document.createElement("tr");celula(tr,it.nome);celula(tr,formatarKz(it.preco));celula(tr,it.quantidade);celula(tr,formatarKz(sub));const a=celula(tr,"");a.append(botaoAcao("Remover","remover-item",String(i)));tb.appendChild(tr);});mostrar("valorTotalPedido",formatarKz(total));}
function adicionarItemPedido(){const p=produtosCache.find(x=>x.id===valor("produtoPedido"));const q=Number(valor("quantidadePedido"));if(!p){alert("Seleciona um produto.");return;}if(!Number.isInteger(q)||q<1){alert("Indica uma quantidade válida.");return;}if(q>Number(p.quantidade)){alert(`Stock insuficiente. Disponível: ${p.quantidade}.`);return;}const existente=itensPedidoAtual.find(x=>x.id===p.id);if(existente){if(existente.quantidade+q>Number(p.quantidade)){alert("A quantidade total ultrapassa o stock disponível.");return;}existente.quantidade+=q;}else itensPedidoAtual.push({id:p.id,nome:p.nome,preco:Number(p.preco),quantidade:q});renderItensPedido();}
async function carregarPedidos(){pedidosCache=await api("/pedidos");if(!Array.isArray(pedidosCache))pedidosCache=[];renderPedidos();}
function renderPedidos(){const tb=$("listaPedidos");if(!tb)return;tb.innerHTML="";pedidosCache.forEach(p=>{const tr=document.createElement("tr");celula(tr,p.numero);celula(tr,p.cliente);celula(tr,p.mesa_numero??p.mesaNumero??"—");celula(tr,(p.itens||[]).map(i=>`${i.nome} x${i.quantidade}`).join(", "));celula(tr,formatarKz(p.total));celula(tr,p.estado);const a=celula(tr,"");if(p.estado!=="Concluído"&&p.estado!=="Cancelado"){a.append(botaoAcao("Concluir","concluir-pedido",p.id),botaoAcao("Cancelar","cancelar-pedido",p.id));}tb.appendChild(tr);});if($("mensagemListaPedidos"))$("mensagemListaPedidos").hidden=pedidosCache.length>0;}
if($("botaoAdicionarItem"))$("botaoAdicionarItem").addEventListener("click",adicionarItemPedido);
if($("itensPedido"))$("itensPedido").addEventListener("click",e=>{const b=e.target.closest("button[data-acao='remover-item']");if(b){itensPedidoAtual.splice(Number(b.dataset.id),1);renderItensPedido();}});
if($("botaoGuardarPedido"))$("botaoGuardarPedido").addEventListener("click",async()=>{if(!valor("clientePedido")||!valor("mesaPedido")||!itensPedidoAtual.length){alert("Indica o cliente, escolhe uma mesa e adiciona pelo menos um produto.");return;}try{await api("/pedidos",{method:"POST",body:JSON.stringify({cliente:valor("clientePedido"),mesaId:valor("mesaPedido"),itens:itensPedidoAtual.map(i=>({id:i.id,quantidade:i.quantidade}))})});itensPedidoAtual=[];renderItensPedido();$("clientePedido").value="";await Promise.all([carregarPedidos(),carregarProdutos(),carregarMesas()]);mostrar("mensagemNovoPedido","Pedido registado com sucesso.");}catch(err){alert(err.message);}});
if($("listaPedidos"))$("listaPedidos").addEventListener("click",async e=>{const b=e.target.closest("button[data-acao]");if(!b)return;const acao=b.dataset.acao;if(!confirm(acao==="concluir-pedido"?"Concluir este pedido e registar a venda?":"Cancelar este pedido e devolver os produtos ao stock?"))return;try{await api(`/pedidos/${encodeURIComponent(b.dataset.id)}/${acao==="concluir-pedido"?"concluir":"cancelar"}`,{method:"POST"});await Promise.all([carregarPedidos(),carregarProdutos(),carregarMesas()]);}catch(err){alert(err.message);}});

// STOCK
async function carregarStock(){const r=await api("/stock");stockCache=r.produtos||[];movimentosCache=await api("/stock/movimentos");if(!Array.isArray(movimentosCache))movimentosCache=[];renderStock();}
function renderStock(){const tb=$("listaStock");if(tb){tb.innerHTML="";const q=valor("pesquisaStock").toLowerCase();stockCache.filter(p=>(p.nome+" "+p.categoria).toLowerCase().includes(q)).forEach(p=>{const tr=document.createElement("tr");celula(tr,p.nome);celula(tr,p.categoria);celula(tr,p.quantidade);celula(tr,Number(p.quantidade)===0?"Sem stock":Number(p.quantidade)<=5?"Stock baixo":"Disponível");tb.appendChild(tr);});}const hm=$("historicoStock");if(hm){hm.innerHTML="";movimentosCache.forEach(m=>{const tr=document.createElement("tr");celula(tr,m.produtoNome);celula(tr,`${m.tipo} — ${m.quantidade}`);celula(tr,m.motivo||"—");celula(tr,m.data||"");hm.appendChild(tr);});}mostrar("quantidadeProdutosStock",stockCache.length);mostrar("totalUnidadesStock",stockCache.reduce((s,p)=>s+Number(p.quantidade||0),0));mostrar("produtosStockBaixo",stockCache.filter(p=>Number(p.quantidade)>0&&Number(p.quantidade)<=5).length);mostrar("produtosSemStock",stockCache.filter(p=>Number(p.quantidade)===0).length);}
if($("formEntradaStock")){$("formEntradaStock").addEventListener("submit",async e=>{e.preventDefault();try{await api("/stock/entrada",{method:"POST",body:JSON.stringify({produtoId:valor("produtoStock"),quantidade:Number(valor("quantidadeEntrada")),motivo:valor("motivoEntrada")})});$("formEntradaStock").reset();await Promise.all([carregarStock(),carregarProdutos()]);alert("Entrada de stock registada.");}catch(err){alert(err.message);}});$("pesquisaStock")?.addEventListener("input",renderStock);}

// FUNCIONÁRIOS
async function carregarFuncionarios(){funcionariosCache=await api("/funcionarios");if(!Array.isArray(funcionariosCache))funcionariosCache=[];renderFuncionarios();}
function renderFuncionarios(){const tb=$("listaFuncionarios");if(!tb)return;tb.innerHTML="";const q=valor("pesquisaFuncionarios").toLowerCase();const lista=funcionariosCache.filter(f=>(f.nome+" "+f.cargo+" "+f.email).toLowerCase().includes(q));lista.forEach(f=>{const tr=document.createElement("tr");celula(tr,f.nome);celula(tr,f.cargo);celula(tr,f.telefone);celula(tr,f.email);celula(tr,f.estado);const a=celula(tr,"");a.append(botaoAcao("Editar","editar-funcionario",f.id),botaoAcao("Eliminar","eliminar-funcionario",f.id));tb.appendChild(tr);});mostrar("totalFuncionarios",funcionariosCache.length);mostrar("funcionariosAtivos",funcionariosCache.filter(f=>f.estado==="Ativo").length);mostrar("funcionariosInativos",funcionariosCache.filter(f=>f.estado==="Inativo").length);}
function limparFuncionario(){$("formFuncionario")?.reset();if($("idFuncionario"))$("idFuncionario").value="";if($("botaoCancelarEdicao"))$("botaoCancelarEdicao").hidden=true;}
if($("formFuncionario")){$("formFuncionario").addEventListener("submit",async e=>{e.preventDefault();const id=valor("idFuncionario");try{await api(id?`/funcionarios/${encodeURIComponent(id)}`:"/funcionarios",{method:id?"PUT":"POST",body:JSON.stringify({nome:valor("nomeFuncionario"),cargo:valor("cargoFuncionario"),telefone:valor("telefoneFuncionario"),email:valor("emailFuncionario"),estado:valor("estadoFuncionario")})});limparFuncionario();await carregarFuncionarios();}catch(err){alert(err.message);}});$("botaoCancelarEdicao")?.addEventListener("click",limparFuncionario);$("pesquisaFuncionarios")?.addEventListener("input",renderFuncionarios);$("listaFuncionarios")?.addEventListener("click",async e=>{const b=e.target.closest("button[data-acao]");if(!b)return;const f=funcionariosCache.find(x=>x.id===b.dataset.id);if(!f)return;if(b.dataset.acao==="editar-funcionario"){["idFuncionario","nomeFuncionario","cargoFuncionario","telefoneFuncionario","emailFuncionario","estadoFuncionario"].forEach((id,i)=>$(id).value=[f.id,f.nome,f.cargo,f.telefone,f.email,f.estado][i]);$("botaoCancelarEdicao").hidden=false;}else if(confirm(`Eliminar ${f.nome}?`)){try{await api(`/funcionarios/${encodeURIComponent(f.id)}`,{method:"DELETE"});await carregarFuncionarios();}catch(err){alert(err.message);}}});}

// VENDAS E FATURAS
async function carregarVendas(){vendasCache=await api("/vendas");if(!Array.isArray(vendasCache))vendasCache=[];renderVendas();}
function renderVendas(){const tb=$("listaVendas");if(!tb)return;tb.innerHTML="";const q=valor("pesquisaVendas").toLowerCase();const lista=vendasCache.filter(v=>String(v.numero).includes(q)||String(v.cliente).toLowerCase().includes(q));lista.forEach(v=>{const tr=document.createElement("tr");celula(tr,v.numero);celula(tr,v.pedidoId||v.pedido_id);celula(tr,v.cliente);celula(tr,v.mesaNumero??v.mesa_numero??"—");celula(tr,(v.itens||[]).map(i=>`${i.nome} x${i.quantidade}`).join(", "));celula(tr,formatarKz(v.total));celula(tr,v.data||v.criado_em||"");const a=celula(tr,"");a.append(botaoAcao("Ver fatura","fatura",v.id));tb.appendChild(tr);});mostrar("quantidadeVendas",vendasCache.length);mostrar("valorFaturado",formatarKz(vendasCache.reduce((s,v)=>s+Number(v.total||0),0)));if($("mensagemVendas"))$("mensagemVendas").hidden=vendasCache.length>0;}
function imprimirFatura(f){const w=window.open("","_blank");if(!w){alert("Permite janelas pop-up para abrir a fatura.");return;}const itens=(f.itens||[]).map(i=>`<tr><td>${escapar(i.nome)}</td><td>${i.quantidade}</td><td>${formatarKz(i.preco)}</td><td>${formatarKz(i.preco*i.quantidade)}</td></tr>`).join("");w.document.write(`<!doctype html><html lang="pt"><meta charset="utf-8"><title>Fatura ${escapar(f.numeroFatura)}</title><style>body{font:15px Arial;max-width:800px;margin:40px auto;color:#222}h1{color:#173b63}table{width:100%;border-collapse:collapse;margin-top:25px}td,th{border-bottom:1px solid #ddd;padding:10px;text-align:left}.total{text-align:right;font-size:22px;font-weight:bold;margin-top:25px}@media print{button{display:none}}</style><h1>${escapar(f.restaurante?.nome||"GOLDREST")}</h1><p>${escapar(f.restaurante?.endereco||"")}<br>${escapar(f.restaurante?.telefone||"")}</p><h2>Fatura ${escapar(f.numeroFatura)}</h2><p>Cliente: ${escapar(f.cliente)}<br>Pedido: ${escapar(f.numeroPedido)} | Mesa: ${escapar(f.mesaNumero)}<br>Data: ${escapar(f.data)}</p><table><thead><tr><th>Produto</th><th>Qtd.</th><th>Preço</th><th>Subtotal</th></tr></thead><tbody>${itens}</tbody></table><p class="total">Total: ${formatarKz(f.total)}</p><button onclick="window.print()">Imprimir fatura</button></html>`);w.document.close();}
if($("pesquisaVendas"))$("pesquisaVendas").addEventListener("input",renderVendas);
if($("listaVendas"))$("listaVendas").addEventListener("click",async e=>{const b=e.target.closest("button[data-acao='fatura']");if(!b)return;try{const f=await api(`/vendas/${encodeURIComponent(b.dataset.id)}/fatura`);imprimirFatura(f);}catch(err){alert(err.message);}});

// DEFINIÇÕES DO RESTAURANTE
async function preencherDefinicoes(){const d=definicoesCache||{};const mapa={nomeRestaurante:"nome",categoriaRestaurante:"categoria",telefoneRestaurante:"telefone",emailRestaurante:"email",enderecoRestaurante:"endereco",horarioRestaurante:"horario",descricaoRestaurante:"descricao"};Object.entries(mapa).forEach(([id,k])=>{if($(id))$(id).value=d[k]||"";});if(d.logo&&$("imagemLogoRestaurante")){$("imagemLogoRestaurante").src=d.logo;$("imagemLogoRestaurante").hidden=false;}}
if($("logoRestaurante"))$("logoRestaurante").addEventListener("change",async()=>{try{const img=await lerImagem($("logoRestaurante").files[0]);if(img&&$("imagemLogoRestaurante")){$("imagemLogoRestaurante").src=img;$("imagemLogoRestaurante").hidden=false;}mostrar("mensagemLogo","Imagem selecionada.");}catch(e){alert(e.message);}});
if($("formDefinicoes"))$("formDefinicoes").addEventListener("submit",async e=>{e.preventDefault();try{let logo=definicoesCache.logo||"";if($("logoRestaurante")?.files[0])logo=await lerImagem($("logoRestaurante").files[0]);const d={nome:valor("nomeRestaurante"),categoria:valor("categoriaRestaurante"),telefone:valor("telefoneRestaurante"),email:valor("emailRestaurante"),endereco:valor("enderecoRestaurante"),horario:valor("horarioRestaurante"),descricao:valor("descricaoRestaurante"),logo};await api("/definicoes",{method:"PUT",body:JSON.stringify(d)});definicoesCache=await api("/definicoes");guardarObjetoDados("definicoesRestaurante",definicoesCache);atualizarIdentidade();mostrar("mensagemDefinicoes","Definições guardadas com sucesso.");}catch(err){alert(err.message);}});
if($("botaoLimparDefinicoes"))$("botaoLimparDefinicoes").addEventListener("click",()=>{if(confirm("Limpar os campos do formulário? Isto não apaga as definições já guardadas."))$("formDefinicoes").reset();});

// PAINEL E RELATÓRIOS
async function carregarPainel(){const [p,m,o,v]=await Promise.all([api("/produtos"),api("/mesas"),api("/pedidos"),api("/vendas")]);produtosCache=p||[];mesasCache=m||[];pedidosCache=o||[];vendasCache=v||[];mostrar("totalProdutos",produtosCache.length);mostrar("totalMesas",mesasCache.length);mostrar("totalPedidos",pedidosCache.length);mostrar("totalVendas",vendasCache.length);if($("mensagemBoasVindas"))mostrar("mensagemBoasVindas",`Bem-vindo, ${utilizadorLogado()?.nome||"Administrador"}!`);}
async function carregarRelatorios(){const [v,o]=await Promise.all([api("/vendas"),api("/pedidos")]);vendasCache=v||[];pedidosCache=o||[];const receita=vendasCache.reduce((s,x)=>s+Number(x.total||0),0);mostrar("relatorioTotalVendas",vendasCache.length);mostrar("relatorioReceita",formatarKz(receita));mostrar("relatorioConcluidos",pedidosCache.filter(x=>x.estado==="Concluído").length);mostrar("relatorioCancelados",pedidosCache.filter(x=>x.estado==="Cancelado").length);const mapa=new Map();vendasCache.forEach(v=>(v.itens||[]).forEach(i=>{const k=i.nome;const x=mapa.get(k)||{nome:k,qtd:0,total:0};x.qtd+=Number(i.quantidade);x.total+=Number(i.preco)*Number(i.quantidade);mapa.set(k,x);}));const tb=$("listaProdutosVendidos");if(tb){tb.innerHTML="";[...mapa.values()].sort((a,b)=>b.qtd-a.qtd).forEach((x,i)=>{const tr=document.createElement("tr");celula(tr,i+1);celula(tr,x.nome);celula(tr,x.qtd);celula(tr,formatarKz(x.total));tb.appendChild(tr);});}const hist=$("historicoRelatorio");if(hist){hist.innerHTML="";vendasCache.forEach(v=>{const tr=document.createElement("tr");celula(tr,v.numero);celula(tr,v.pedidoId||v.pedido_id);celula(tr,v.mesaNumero??v.mesa_numero??"—");celula(tr,v.cliente);celula(tr,formatarKz(v.total));celula(tr,v.data||v.criado_em||"");hist.appendChild(tr);});}}

// ARRANQUE DA PÁGINA
(async function iniciar(){
 if(!protegerPagina())return;
 if($("formLogin")||$("formCadastro"))return;
 try{
  await carregarDefinicoes();
  const tarefas=[];
  if($("formProduto")||$("listaProdutos"))tarefas.push(carregarProdutos());
  if($("formMesa")||$("listaMesas"))tarefas.push(carregarMesas());
  if($("listaPedidos")||$("botaoGuardarPedido"))tarefas.push(Promise.all([carregarProdutos(),carregarMesas(),carregarPedidos()]));
  if($("formEntradaStock")||$("listaStock"))tarefas.push(Promise.all([carregarProdutos(),carregarStock()]));
  if($("formFuncionario")||$("listaFuncionarios"))tarefas.push(carregarFuncionarios());
  if($("listaVendas"))tarefas.push(carregarVendas());
  if($("formDefinicoes"))tarefas.push(preencherDefinicoes());
  if($("totalProdutos")||$("mensagemBoasVindas"))tarefas.push(carregarPainel());
  if($("listaProdutosVendidos")||$("historicoRelatorio"))tarefas.push(carregarRelatorios());
  await Promise.all(tarefas);
 }catch(err){console.error(err);const alvo=$("mensagemDefinicoes")||$("mensagemVendas")||$("mensagemListaPedidos");if(alvo)alvo.textContent=err.message;else if(!$("formLogin")&&!$("formCadastro"))alert(err.message);}
})();
