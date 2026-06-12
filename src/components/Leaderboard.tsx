/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Zap, Compass, Bike, Medal } from 'lucide-react';
import { Racer, GameSettings } from '../types';

interface LeaderboardProps {
  racers: Racer[];
  settings: GameSettings;
  raceDistance: number;
}

export default function Leaderboard({ racers, settings, raceDistance }: LeaderboardProps) {
  // Sort racers by distance descending to get live standing
  const sortedRacers = [...racers].sort((a, b) => b.distance - a.distance);

  // Map ranking values
  const getRankIcon = (rankIndex: number) => {
    switch (rankIndex) {
      case 0:
        return <Trophy className="w-5 h-5 text-yellow-400" id="trophy-gold" />;
      case 1:
        return <Medal className="w-5 h-5 text-slate-300" id="medal-silver" />;
      case 2:
        return <Medal className="w-5 h-5 text-amber-600" id="medal-bronze" />;
      default:
        return <span className="text-xs font-mono font-bold text-slate-400">{rankIndex + 1}</span>;
    }
  };

  const currentTheme = settings.isLowLightTheme ? 'dark' : 'standard';

  return (
    <div
      id="live-leaderboard"
      className={`p-5 rounded-2xl border transition-all duration-300 backdrop-blur-md ${
        settings.isLowLightTheme
          ? 'bg-slate-950/80 border-cyan-500/20 shadow-lg shadow-cyan-500/5'
          : 'bg-white/80 border-slate-200/80 shadow-md'
      }`}
    >
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-dashed border-slate-500/20">
        <div className="flex items-center gap-2">
          <Trophy className={`w-5 h-5 ${settings.isLowLightTheme ? 'text-cyan-400' : 'text-indigo-600'}`} />
          <h2 className={`font-sans font-bold tracking-tight text-lg ${settings.isLowLightTheme ? 'text-cyan-100' : 'text-slate-800'}`}>
            Live Standings
          </h2>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-500/15 text-slate-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          RACE LIVE
        </div>
      </div>

      <div className="space-y-2.5">
        <AnimatePresence mode="popLayout">
          {sortedRacers.map((racer, index) => {
            const progressPercent = Math.min((racer.distance / raceDistance) * 105, 100);
            const isSelf = racer.isPlayer;

            return (
              <motion.div
                key={racer.id}
                layoutId={`racer-item-${racer.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className={`relative overflow-hidden p-3 rounded-xl border flex flex-col gap-2 transition-all duration-300 ${
                  isSelf
                    ? settings.isLowLightTheme
                      ? 'bg-cyan-950/35 border-cyan-400/50 shadow-md shadow-cyan-500/10'
                      : 'bg-indigo-50/60 border-indigo-200 shadow-sm'
                    : settings.isLowLightTheme
                    ? 'bg-slate-900/40 border-slate-800'
                    : 'bg-slate-50/40 border-slate-100'
                }`}
              >
                {/* Background progress bar */}
                <div
                  className="absolute bottom-0 left-0 h-1 transition-all duration-300"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: isSelf
                      ? settings.isLowLightTheme ? '#06b6d4' : '#6366f1'
                      : settings.isLowLightTheme ? '#475569' : '#cbd5e1',
                    opacity: isSelf ? 0.7 : 0.3,
                  }}
                />

                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 flex items-center justify-center rounded-full font-sans ${
                      isSelf 
                        ? settings.isLowLightTheme ? 'bg-cyan-500/20 border border-cyan-400/40' : 'bg-indigo-100 border border-indigo-200'
                        : 'bg-slate-500/10'
                    }`}>
                      {getRankIcon(index)}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-lg leading-none">{racer.avatar}</span>
                      <span className={`font-sans font-semibold text-sm ${
                        isSelf 
                          ? settings.isLowLightTheme ? 'text-cyan-300' : 'text-indigo-900'
                          : settings.isLowLightTheme ? 'text-slate-200' : 'text-slate-700'
                      }`}>
                        {racer.name} {isSelf && <span className="text-xs font-normal opacity-75">(You)</span>}
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-3">
                    <div className="flex flex-col items-end">
                      <span className={`font-mono font-bold text-xs ${
                        isSelf 
                          ? settings.isLowLightTheme ? 'text-cyan-400' : 'text-indigo-600'
                          : settings.isLowLightTheme ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        {racer.speed.toFixed(1)} <span className="text-[9px] font-sans font-normal">km/h</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {racer.distance.toFixed(0)}m / {raceDistance}m
                      </span>
                    </div>
                  </div>
                </div>

                {isSelf && racer.lightAlignment > 0 && (
                  <div className="flex items-center justify-between gap-2 z-10 mt-0.5">
                    <div className="flex items-center gap-1">
                      <Zap className={`w-3.5 h-3.5 animate-pulse ${
                        racer.lightAlignment > 80
                          ? 'text-cyan-400'
                          : racer.lightAlignment > 40
                          ? 'text-amber-400'
                          : 'text-slate-500'
                      }`} />
                      <span className="font-sans text-[10px] text-slate-500 font-semibold uppercase">
                        {racer.lightAlignment > 80 ? 'Perfect Alignment' : racer.lightAlignment > 40 ? 'Light Stream Sync' : 'Out of Light'}
                      </span>
                    </div>
                    <div className="w-24 bg-slate-500/20 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-150 ${
                          racer.lightAlignment > 80
                            ? 'bg-cyan-400'
                            : racer.lightAlignment > 40
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                        }`}
                        style={{ width: `${racer.lightAlignment}%` }}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-500/10 flex justify-between text-[11px] text-slate-500 font-sans">
        <span className="flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-cyan-400" /> Use W/S or Arrow Keys to throttle & brake
        </span>
        <span className="flex items-center gap-1">
          <Compass className="w-3 h-3 text-cyan-400" /> Follow the dynamic neon light path!
        </span>
      </div>
    </div>
  );
}
