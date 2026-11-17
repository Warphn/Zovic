import { describe, expect, it } from "bun:test"
import { createMusicsInOrder, moveItem, musicNameFromFileName, orderByIds, sortByFileName } from "./music-batch"

describe("musicNameFromFileName", () => {
  it("tira a extensão", () => {
    expect(musicNameFromFileName("Coven.mp3")).toBe("Coven")
  })

  it("tira o número da faixa do começo, nos formatos comuns", () => {
    expect(musicNameFromFileName("01 - Coven.mp3")).toBe("Coven")
    expect(musicNameFromFileName("02. Lua de Prata.mp3")).toBe("Lua de Prata")
    expect(musicNameFromFileName("3 Noite.MP3")).toBe("Noite")
    expect(musicNameFromFileName("04_Fim_de_tarde.mp3")).toBe("Fim de tarde")
  })

  it("mantém um nome que é só número", () => {
    expect(musicNameFromFileName("1979.mp3")).toBe("1979")
    expect(musicNameFromFileName("07 - 1979.mp3")).toBe("1979")
  })
})

describe("sortByFileName", () => {
  it("ordena pelo número da faixa, com 10 depois de 9", () => {
    const tracks = ["10 - Dez.mp3", "2 - Dois.mp3", "1 - Um.mp3", "9 - Nove.mp3"].map((fileName) => ({ fileName }))

    expect(sortByFileName(tracks, (track) => track.fileName).map((track) => track.fileName)).toEqual([
      "1 - Um.mp3",
      "2 - Dois.mp3",
      "9 - Nove.mp3",
      "10 - Dez.mp3",
    ])
  })
})

describe("moveItem", () => {
  it("sobe e desce um item uma posição", () => {
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "c", "b"])
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"])
  })

  it("não muda a lista quando o destino passa das pontas", () => {
    const tracks = ["a", "b", "c"]

    expect(moveItem(tracks, 0, -1)).toEqual(["a", "b", "c"])
    expect(moveItem(tracks, 2, 3)).toEqual(["a", "b", "c"])
  })

  it("não altera a lista original", () => {
    const tracks = ["a", "b", "c"]

    moveItem(tracks, 0, 2)

    expect(tracks).toEqual(["a", "b", "c"])
  })
})

describe("orderByIds", () => {
  it("põe os itens na ordem dos ids, como o arrastar devolve", () => {
    const tracks = [{ id: "a" }, { id: "b" }, { id: "c" }]

    expect(orderByIds(tracks, ["c", "a", "b"], (track) => track.id).map((track) => track.id)).toEqual(["c", "a", "b"])
  })
})

describe("createMusicsInOrder", () => {
  it("cadastra uma por vez, na ordem, para o número da faixa seguir a ordem da lista", async () => {
    const started: string[] = []
    const finished: string[] = []
    const create = async (name: string) => {
      started.push(name)
      await Promise.resolve()
      finished.push(name)
    }

    const result = await createMusicsInOrder(["a", "b", "c"], create)

    expect(result).toEqual({ createdCount: 3, error: null })
    expect(started).toEqual(["a", "b", "c"])
    expect(finished).toEqual(["a", "b", "c"])
  })

  it("para na primeira falha e diz quantas entraram, para as seguintes não pularem a faixa que falhou", async () => {
    const failure = new Error("O áudio pode ter no máximo 20 MB")
    const attempted: string[] = []
    const create = async (name: string) => {
      attempted.push(name)
      if (name === "b") throw failure
    }

    const result = await createMusicsInOrder(["a", "b", "c"], create)

    expect(result).toEqual({ createdCount: 1, error: failure })
    expect(attempted).toEqual(["a", "b"])
  })

  it("avisa cada música cadastrada, para a tela mostrar o progresso", async () => {
    const created: string[] = []

    await createMusicsInOrder(["a", "b"], async () => {}, (name) => created.push(name))

    expect(created).toEqual(["a", "b"])
  })
})
