# Lido pelo latexmk local (vimtex, make) E pelo do Overleaf, que roda latexmk
# dentro da pasta do projeto.
#
# O template exige LuaLaTeX (fontspec). O Overleaf passa o compilador escolhido
# no menu do projeto, e o padrão é pdfLaTeX (-pdf): sem o mapeamento abaixo, um
# projeto novo ou um colaborador que troque o compilador cai em "fontspec
# requires either XeTeX or LuaTeX". Com ele, -pdf também roda o lualatex.
#
# -shell-escape: o pacote svg (\includesvg) exige escape irrestrito. O minted
# funciona sem ele, porque o latexminted está liberado no escape restrito.
#
# `$engine = '... %O %S'`, e não `.=`: opção depois do nome do .tex é ignorada.
$pdflatex = 'lualatex -shell-escape %O %S';
$lualatex = 'lualatex -shell-escape %O %S';
