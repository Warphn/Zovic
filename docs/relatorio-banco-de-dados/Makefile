# ===== Config =====
# Configuração explícita para funcionar sem um .latexmkrc pessoal
MAIN    := main
OUTDIR  := build
LATEXMK := latexmk

LATEXMK_FLAGS := -lualatex -shell-escape -outdir=$(OUTDIR) \
	-interaction=nonstopmode -halt-on-error -file-line-error -synctex=1

# ===== Targets =====
.PHONY: all pdf clean distclean watch check-fonts

all: pdf

pdf: check-fonts
	@mkdir -p $(OUTDIR)
	$(LATEXMK) $(LATEXMK_FLAGS) $(MAIN).tex

# recompila automaticamente ao salvar (precisa latexmk instalado)
watch: check-fonts
	@mkdir -p $(OUTDIR)
	$(LATEXMK) $(LATEXMK_FLAGS) -pvc $(MAIN).tex

# limpa só o build
clean:
	$(LATEXMK) -c -outdir=$(OUTDIR) $(MAIN).tex || true
	rm -rf $(OUTDIR)

# limpa também lixo gerado no diretório raiz (se houver)
distclean: clean
	rm -f $(MAIN).aux $(MAIN).bbl $(MAIN).bcf $(MAIN).blg $(MAIN).fdb_latexmk \
	      $(MAIN).fls $(MAIN).log $(MAIN).out $(MAIN).run.xml $(MAIN).synctex.gz \
	      $(MAIN).toc

# checa se as fontes existem (pra evitar erro misterioso)
check-fonts:
	@test -f ./fontes/copperplate_gothic_bt.ttf || \
	  (echo "ERRO: fonte './fontes/copperplate_gothic_bt.ttf' nao encontrada."; exit 1)
	@test -f ./fontes/CopperplateGothicBT-Bold.otf || \
	  (echo "ERRO: fonte './fontes/CopperplateGothicBT-Bold.otf' nao encontrada."; exit 1)
