import Link from "next/link";

export default function CreateTripFlow() {
  return (
    <Link
      className="group flex min-h-[18rem] w-full flex-col justify-between border-2 sm:border-4 border-dashed border-[#121212] bg-white p-5 text-left shadow-[4px_4px_0px_0px_black] sm:shadow-[8px_8px_0px_0px_black] transition-all duration-200 hover:-translate-y-1 hover:border-solid hover:bg-[#F0C020]"
      href="/trips/new"
    >
      <div className="flex h-14 w-14 items-center justify-center border-2 border-[#121212] bg-[#D02020] text-3xl font-black text-white shadow-[3px_3px_0px_0px_black]">
        +
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-[#D02020] group-hover:text-[#121212]">Start planning</p>
        <h3 className="font-display text-2xl font-black uppercase leading-[0.9] tracking-tighter text-[#121212] sm:text-3xl">Create New Trip</h3>
        <p className="text-sm font-medium leading-6 text-[#888888] group-hover:text-[#121212]/70">
          Pick the dates, drop in a dreamy cover image, and get invite links ready in one go.
        </p>
      </div>
    </Link>
  );
}
