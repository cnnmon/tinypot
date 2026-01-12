'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import BranchDesign from '../Editor/Branchbar/BranchDesign';

export default function Header() {
  const router = useRouter();
  const [randomNumber, setRandomNumber] = useState(0);

  useEffect(() => {
    setRandomNumber(Math.random());
  }, []);

  return (
    <>
      <div
        className="flex items-center justify-center gap-1 cursor-pointer hover:opacity-50 transition-opacity"
        onClick={() => router.push('/')}
      >
        <p>bonsai</p>
        <div className="relative flex justify-center items-center mb-1">
          <BranchDesign seed={randomNumber} width={25} height={25} />
          <Image
            alt="plantpot"
            src="/icons/PlantPot.svg"
            width={15}
            height={15}
            className="absolute top-[12px]"
          />
        </div>
      </div>
    </>
  );
}
