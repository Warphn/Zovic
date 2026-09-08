import Image from 'next/image';

export default function Hero() {
  return (
    <section className="flex w-screen h-[50vh] m-16 bg-red-50 justify-between">
      <div className="flex flex-col justify-center gap-5">
        <h1 className="text-8xl font-semibold leading-[0.9]">
          Suas músicas,<br />
          do seu jeito
        </h1>
        <p className="text-2xl">Crie playlists personalizadas e organize suas músicas com facilidade.</p>
      </div>
      <Image src="https://placehold.co/600x400" alt='placeholder' width={600} height={400} unoptimized />
    </section>
  );
}
