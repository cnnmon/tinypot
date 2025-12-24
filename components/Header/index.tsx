'use client';

import Image from 'next/image';
import CaretDown from '../../public/icons/CaretDown.svg';
import BranchDesign from '../Editor/Branches/BranchDesign';

export default function Header() {
  return (
    <div className="flex gap-4">
      <div className="flex items-center justify-center gap-1">
        <p>tinypot</p>
        <div className="relative flex justify-center items-center mb-1">
          <BranchDesign seed={1} width={25} height={25} />
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
