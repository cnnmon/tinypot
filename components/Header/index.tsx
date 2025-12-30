'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import CaretDown from '../../public/icons/CaretDown.svg';
import BranchDesign from '../Editor/Branchbar/BranchDesign';

export default function Header() {
  const [randomNumber, setRandomNumber] = useState(0);

  useEffect(() => {
    setRandomNumber(Math.random());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex gap-4">
      <div className="flex items-center justify-center gap-1">
        <p>tinypot</p>
        <div className="relative flex justify-center items-center mb-1">
          <BranchDesign seed={randomNumber} width={25} height={25} />
          <Image
            alt="plantpot"
            src="icons/PlantPot.svg"
            width={15}
            height={15}
            className="absolute top-[12px]"
          />
        </div>
      </div>

      <button className="flex items-center justify-center gap-1">
        <p>New project</p>
        <CaretDown width={20} className="stroke-current" />
      </button>
    </div>
  );
}
