export default function MuscleHighlight({ primaryMuscles = [], secondaryMuscles = [] }) {
  const getFill = (muscleId) => {
    if (primaryMuscles.includes(muscleId)) return 'color-mix(in oklab, var(--protein) 60%, transparent)';
    if (secondaryMuscles.includes(muscleId)) return 'color-mix(in oklab, var(--cal) 40%, transparent)';
    return 'color-mix(in oklab, var(--text-3) 20%, transparent)';
  };

  return (
    <div className="flex items-center justify-center gap-3">
      {/* Front View */}
      <div className="text-center">
        <p className="text-[10px] text-tx-3 mb-1">Front</p>
        <svg viewBox="0 0 120 280" width="130" height="300" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
          {/* Head */}
          <ellipse cx="60" cy="16" rx="12" ry="14" fill="var(--hair)" opacity="0.25" />
          {/* Neck */}
          <rect x="54" y="28" width="12" height="8" rx="3" fill="var(--hair)" opacity="0.18" />

          {/* Chest */}
          <path d="M44,38 Q42,40 42,46 L44,54 Q50,58 60,58 Q70,58 76,54 L78,46 Q78,40 76,38 Q68,34 60,34 Q52,34 44,38Z" fill={getFill('chest')} />
          <line x1="60" y1="36" x2="60" y2="58" stroke="var(--card)" strokeWidth="1" opacity="0.4" />

          {/* Front Delts */}
          <path d="M42,36 Q36,34 32,40 L28,50 Q28,54 30,56 L34,54 L38,46 L42,42Z" fill={getFill('front_delts')} />
          <path d="M78,36 Q84,34 88,40 L92,50 Q92,54 90,56 L86,54 L82,46 L78,42Z" fill={getFill('front_delts')} />

          {/* Side Delts */}
          <path d="M30,40 Q26,38 24,44 L22,54 L26,58 L30,56 L32,48Z" fill={getFill('side_delts')} />
          <path d="M90,40 Q94,38 96,44 L98,54 L94,58 L90,56 L88,48Z" fill={getFill('side_delts')} />

          {/* Biceps */}
          <path d="M26,58 L22,66 L18,80 L16,90 Q18,94 22,92 L26,82 L30,70 L32,60Z" fill={getFill('biceps')} />
          <path d="M94,58 L98,66 L102,80 L104,90 Q102,94 98,92 L94,82 L90,70 L88,60Z" fill={getFill('biceps')} />

          {/* Forearms */}
          <path d="M16,92 L14,106 L12,120 L12,132 Q12,138 16,138 L20,136 L22,124 L24,110 L24,96Z" fill={getFill('forearms')} />
          <path d="M104,92 L106,106 L108,120 L108,132 Q108,138 104,138 L100,136 L98,124 L96,110 L96,96Z" fill={getFill('forearms')} />

          {/* Abs */}
          <path d="M50,60 L48,70 L48,84 L48,98 L50,112 Q54,118 60,118 Q66,118 70,112 L72,98 L72,84 L72,70 L70,60 Q66,58 60,58 Q54,58 50,60Z" fill={getFill('abs')} />
          <line x1="60" y1="60" x2="60" y2="118" stroke="var(--card)" strokeWidth="0.8" opacity="0.35" />
          <line x1="49" y1="72" x2="71" y2="72" stroke="var(--card)" strokeWidth="0.6" opacity="0.25" />
          <line x1="48" y1="84" x2="72" y2="84" stroke="var(--card)" strokeWidth="0.6" opacity="0.25" />
          <line x1="49" y1="96" x2="71" y2="96" stroke="var(--card)" strokeWidth="0.6" opacity="0.25" />

          {/* Obliques */}
          <path d="M42,56 L40,68 L38,84 L38,100 L40,114 L44,120 L48,118 L50,112 L48,98 L48,84 L48,70 L46,58Z" fill={getFill('obliques')} />
          <path d="M78,56 L80,68 L82,84 L82,100 L80,114 L76,120 L72,118 L70,112 L72,98 L72,84 L72,70 L74,58Z" fill={getFill('obliques')} />

          {/* Hip Flexors */}
          <path d="M44,120 L40,126 L38,134 L40,138 L46,136 L50,130 L52,124 Q48,122 44,120Z" fill={getFill('hip_flexors')} />
          <path d="M76,120 L80,126 L82,134 L80,138 L74,136 L70,130 L68,124 Q72,122 76,120Z" fill={getFill('hip_flexors')} />

          {/* Adductors */}
          <path d="M52,126 L50,140 L48,158 L50,170 L54,168 L56,154 L58,140 L58,128 Q56,124 52,126Z" fill={getFill('adductors')} />
          <path d="M68,126 L70,140 L72,158 L70,170 L66,168 L64,154 L62,140 L62,128 Q64,124 68,126Z" fill={getFill('adductors')} />

          {/* Quads */}
          <path d="M40,134 L36,150 L34,170 L32,190 L34,206 L38,210 L44,208 L48,200 L50,186 L50,170 L48,154 L46,138Z" fill={getFill('quads')} />
          <path d="M80,134 L84,150 L86,170 L88,190 L86,206 L82,210 L76,208 L72,200 L70,186 L70,170 L72,154 L74,138Z" fill={getFill('quads')} />

          {/* Lower legs (front — not highlighted) */}
          <path d="M34,212 L32,228 L30,244 Q28,252 32,254 L38,252 L40,240 L42,224 L44,210Z" fill="var(--hair)" opacity="0.12" />
          <path d="M86,212 L88,228 L90,244 Q92,252 88,254 L82,252 L80,240 L78,224 L76,210Z" fill="var(--hair)" opacity="0.12" />
        </svg>
      </div>

      {/* Back View */}
      <div className="text-center">
        <p className="text-[10px] text-tx-3 mb-1">Back</p>
        <svg viewBox="0 0 120 280" width="130" height="300" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
          {/* Head */}
          <ellipse cx="60" cy="16" rx="12" ry="14" fill="var(--hair)" opacity="0.25" />
          {/* Neck */}
          <rect x="54" y="28" width="12" height="8" rx="3" fill="var(--hair)" opacity="0.18" />

          {/* Traps */}
          <path d="M48,34 L44,36 Q40,38 38,42 L36,48 L42,46 L50,40 L56,36 L60,34 L64,36 L70,40 L78,46 L84,48 L82,42 Q80,38 76,36 L72,34 Q66,32 60,32 Q54,32 48,34Z" fill={getFill('traps')} />

          {/* Rear Delts */}
          <path d="M36,40 Q30,38 26,44 L24,52 L26,56 L30,54 L34,48 L38,42Z" fill={getFill('rear_delts')} />
          <path d="M84,40 Q90,38 94,44 L96,52 L94,56 L90,54 L86,48 L82,42Z" fill={getFill('rear_delts')} />

          {/* Upper Back */}
          <path d="M46,44 L42,48 L40,56 L40,68 L42,76 L48,78 L54,76 L58,70 L60,62 L58,52 L54,46Z" fill={getFill('upper_back')} />
          <path d="M74,44 L78,48 L80,56 L80,68 L78,76 L72,78 L66,76 L62,70 L60,62 L62,52 L66,46Z" fill={getFill('upper_back')} />
          <line x1="60" y1="34" x2="60" y2="116" stroke="var(--card)" strokeWidth="1" opacity="0.3" />

          {/* Lats */}
          <path d="M40,68 L36,72 L34,82 L34,96 L36,106 L40,112 L46,114 L50,108 L52,96 L52,84 L50,78 L46,74Z" fill={getFill('lats')} />
          <path d="M80,68 L84,72 L86,82 L86,96 L84,106 L80,112 L74,114 L70,108 L68,96 L68,84 L70,78 L74,74Z" fill={getFill('lats')} />

          {/* Triceps */}
          <path d="M28,56 L24,64 L20,78 L18,90 Q20,94 24,92 L28,82 L32,68 L34,58Z" fill={getFill('triceps')} />
          <path d="M92,56 L96,64 L100,78 L102,90 Q100,94 96,92 L92,82 L88,68 L86,58Z" fill={getFill('triceps')} />

          {/* Lower Back */}
          <path d="M48,100 L44,106 L42,114 L44,120 L50,122 L56,120 L58,114 L60,106 L62,114 L64,120 L70,122 L76,120 L78,114 L76,106 L72,100 L66,96 L60,94 L54,96Z" fill={getFill('lower_back')} />

          {/* Glutes */}
          <path d="M40,120 L38,128 L38,136 L40,142 L46,146 L52,144 L56,138 L58,130 L60,126 L62,130 L64,138 L68,144 L74,146 L80,142 L82,136 L82,128 L80,120 Q72,124 60,124 Q48,124 40,120Z" fill={getFill('glutes')} />
          <line x1="60" y1="122" x2="60" y2="146" stroke="var(--card)" strokeWidth="1" opacity="0.35" />

          {/* Hamstrings */}
          <path d="M38,142 L36,156 L34,172 L34,190 L36,206 L40,210 L46,208 L50,198 L52,184 L52,168 L52,154 L50,144 L46,146 L42,144Z" fill={getFill('hamstrings')} />
          <path d="M82,142 L84,156 L86,172 L86,190 L84,206 L80,210 L74,208 L70,198 L68,184 L68,168 L68,154 L70,144 L74,146 L78,144Z" fill={getFill('hamstrings')} />

          {/* Calves */}
          <path d="M36,210 L34,218 L32,228 L30,240 L30,248 Q30,254 34,254 L38,252 L40,244 L42,232 L44,220 L44,212Z" fill={getFill('calves')} />
          <path d="M84,210 L86,218 L88,228 L90,240 L90,248 Q90,254 86,254 L82,252 L80,244 L78,232 L76,220 L76,212Z" fill={getFill('calves')} />

          {/* Forearms (back, not highlighted) */}
          <path d="M18,92 L16,106 L14,120 L14,132 Q14,138 18,138 L22,136 L24,124 L26,110 L26,96Z" fill="var(--hair)" opacity="0.12" />
          <path d="M102,92 L104,106 L106,120 L106,132 Q106,138 102,138 L98,136 L96,124 L94,110 L94,96Z" fill="var(--hair)" opacity="0.12" />
        </svg>
      </div>
    </div>
  );
}
