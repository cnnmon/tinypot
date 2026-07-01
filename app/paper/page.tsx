'use client';

import { useState } from 'react';
import Image from 'next/image';
import { twMerge } from 'tailwind-merge';

const CITATION_ACM = `Tiffany Wang and Max Kreminski. 2026. Bonsai: Designing for Cultivation in AI Interactive Digital Narratives. In Proceedings of the 2026 ACM Conference on Creativity and Cognition (C&C '26). Association for Computing Machinery, New York, NY, USA.`;

const CITATION_BIBTEX = `@inproceedings{wang2026bonsai,
  title     = {Bonsai: Designing for Cultivation in {AI} Interactive Digital Narratives},
  author    = {Wang, Tiffany and Kreminski, Max},
  booktitle = {Proceedings of the 2026 ACM Conference on Creativity and Cognition},
  series    = {C\\&C '26},
  year      = {2026},
  location  = {London, United Kingdom},
  publisher = {Association for Computing Machinery},
  address   = {New York, NY, USA},
}`;

export default function PaperPage() {
  const [citeFmt, setCiteFmt] = useState<'acm' | 'bibtex'>('acm');
  const [copied, setCopied] = useState(false);

  const citationText = citeFmt === 'acm' ? CITATION_ACM : CITATION_BIBTEX;

  const handleCopy = () => {
    navigator.clipboard.writeText(citationText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b to-[#EBF7D2] from-white bg-fixed">
      <div className="max-w-2xl mx-auto px-6 py-16 flex flex-col gap-12">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-neutral-400">C&C '26 · July 13-16, 2026 · London, United Kingdom</p>
            <p className="text-neutral-400">Human-AI Co-Creativity @ ICML '26 · July 6-11, 2026 · Seoul, South Korea</p>
          </div>

          <h2 className="leading-snug text-2xl font-bold">
            Bonsai: Designing for Cultivation in AI Interactive Digital Narratives
          </h2>
          <div className="flex flex-wrap gap-x-8 gap-y-1">
            <div>
              <p className="font-medium">Tiffany Wang</p>
              <p className="text-neutral-500">
                Midjourney ·{' '}
                <a href="mailto:wangttiffany@gmail.com" className="underline">
                  wangttiffany@gmail.com
                </a>
              </p>
            </div>
            <div>
              <p className="font-medium">Max Kreminski</p>
              <p className="text-neutral-500">
                Cornell Tech ·{' '}
                <a href="mailto:mkremins@cornell.edu" className="underline">
                  mkremins@cornell.edu
                </a>
              </p>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href="/paper/Bonsai_C%26C2026.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 border-2 hover:bg-black hover:text-white transition-colors"
            >
              PDF
            </a>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 border-2 hover:bg-black hover:text-white transition-colors"
            >
              Live demo
            </a>
          </div>
        </div>

        <Image
          src="/paper/diagram.png"
          alt="How Bonsai works: Authors seed an initial script. Players interact in natural language. The system improvises for players in real-time while being responsive to authorial correction."
          width={1138}
          height={531}
          className={twMerge('w-full h-auto border-2 border-black shadow-lg p-2 bg-white')}
        />

        {/* Abstract */}
        <div className="flex flex-col gap-3">
          <h2>Abstract</h2>
          <p className="text-neutral-700 leading-relaxed">
            Authors of LLM-based interactive digital narratives (IDNs) struggle to preserve creative intent as player
            choices and real-time generation pull storylines in unpredictable directions. Existing frameworks treat IDNs
            as static once published, limiting authors' insight into and control over the storylines that emerge from
            unexpected player input in the wild. We propose <em>cultivation</em>: a design metaphor in which
            LLM-generated branches are stored as persistent material for authors to shape through iterative curation.
            Authors seed an initial scenario; the system grows new branches in response to player exploration; authors
            prune and revise what emerges, accumulating preference data that steers future generation. We demonstrate
            cultivation through Bonsai, an IDN authoring tool, and complement this design account with three simulated
            experiments showing that learned preferences transfer to unseen scenes, are project-specific rather than
            portable, and improve substantially when extraction is structured around IDN authoring categories. This
            metaphor reframes human-AI creative collaboration: authors become gardeners, tending ever-growing branches
            rather than constraining ephemeral outputs.
          </p>
        </div>

        {/* Contributions */}
        <div className="flex flex-col gap-3">
          <h2>Contributions</h2>
          <ol className="flex flex-col gap-2 text-neutral-700 list-decimal list-inside">
            <li>
              <strong>Bonsai</strong>, an IDN authoring tool instantiating cultivation through four phases (seeding,
              growing, pruning, adapting)
            </li>
            <li>
              <strong>Cultivation</strong>, a design metaphor for LLM-based authoring in which narratives remain live
              after publication, accumulating design knowledge through use
            </li>
            <li>
              <strong>Three simulated experiments</strong> probing edit-based preference learning in IDN authoring
            </li>
            <li>
              <strong>Design implications</strong> of the cultivation metaphor for authoring LLM-based interactive
              systems
            </li>
          </ol>
        </div>

        {/* Keywords */}
        <div className="flex flex-col gap-3">
          <h2>Keywords</h2>
          <div className="flex flex-wrap gap-2">
            {[
              'interactive narrative',
              'human-AI co-creativity',
              'large language models',
              'authoring tools',
              'research through design',
              'computational creativity',
              'generative AI',
            ].map((kw) => (
              <span key={kw} className="px-2 py-0.5 bg-neutral-300/50 text-neutral-600">
                {kw}
              </span>
            ))}
          </div>
        </div>

        {/* Related work from the same authors */}
        <div className="flex flex-col gap-3">
          <h2>Related work</h2>
          <div className="flex flex-col gap-3">
            <div className="border-l-2 pl-4">
              <p className="font-medium">Dramamancer: Interactive Narratives with LLM-powered Storylets</p>
              <p className="text-neutral-500">Wang, Sun, Wang, Roemmele, Chung, Kreminski · UIST Adjunct '25</p>
              <a
                href="https://doi.org/10.1145/3746058.3758995"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-400 underline"
              >
                doi:10.1145/3746058.3758995
              </a>
            </div>
            <div className="border-l-2 pl-4">
              <p className="font-medium">Gardening Games: An Alternative Philosophy of PCG in Games</p>
              <p className="text-neutral-500">Kreminski & Wardrip-Fruin · FDG PCG Workshop 2018</p>
              <a
                href="https://mkremins.github.io/publications/GardeningGames.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-400 underline"
              >
                PDF
              </a>
            </div>
          </div>
        </div>

        {/* Cite */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2>Cite</h2>
            <div className="flex gap-1">
              {(['acm', 'bibtex'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setCiteFmt(fmt)}
                  className={`px-2 py-0.5 border-2 transition-colors ${citeFmt === fmt ? 'bg-black text-white' : 'hover:bg-neutral-100'}`}
                >
                  {fmt === 'acm' ? 'ACM' : 'BibTeX'}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <pre className="bg-neutral-50 border p-4 text-neutral-700 whitespace-pre-wrap leading-relaxed overflow-x-auto">
              {citationText}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 px-2 py-0.5 bg-white border hover:bg-black hover:text-white transition-colors"
            >
              {copied ? 'copied!' : 'copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
