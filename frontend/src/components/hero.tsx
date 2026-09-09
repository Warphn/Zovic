import { Button } from "./ui/button";

export default function Hero() {
  return (
    <section className="flex flex-col w-screen h-[50vh] m-16 justify-center items-center">
        <h1 className="text-8xl font-semibold text-center leading-[0.9] mb-5">
          Suas músicas<br />
          do seu jeito
        </h1>
      <p className="text-xl text-center mb-8">Crie playlists personalizadas e organize suas músicas com facilidade.</p>
      <div className="flex flex-row items-center gap-4">
        <Button variant="default" size="lg" className="h-12 px-8 text-base">
          Criar minha conta
        </Button>
        <Button variant="outline" size="lg" className="h-12 px-8 text-base">
          Ver como funciona
        </Button>
      </div>
    </section>
  );
}
