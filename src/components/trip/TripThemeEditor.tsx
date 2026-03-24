"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import Button from "@/components/ui/Button";
import BackgroundEffects from "@/components/trip/BackgroundEffects";
import TripThemeProvider from "@/components/trip/TripThemeProvider";
import type {
  TripTheme,
  TripThemeColorScheme,
  TripThemeEffect,
} from "@/lib/types";

// ── SVG Background Generators ───────────────────────────────────────

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function createOriginalPreviewSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900"><rect fill="#F0F0F0" width="1440" height="900"/><circle cx="400" cy="380" r="140" fill="#D02020" opacity=".12"/><rect x="650" y="250" width="220" height="220" fill="#1040C0" opacity=".1" transform="rotate(15 760 360)"/><polygon points="1100,180 1220,420 980,420" fill="#F0C020" opacity=".12"/><circle cx="250" cy="700" r="80" fill="#D02020" opacity=".06"/><rect x="1200" y="620" width="120" height="120" fill="#1040C0" opacity=".06"/></svg>`;
}

function createNightSvg(): string {
  // Stars scattered across the sky
  const stars: string[] = [];
  for (let i = 0; i < 80; i++) {
    const x = (i * 97 + 13) % 1440;
    const y = (i * 43 + 7) % 600;
    const r = (0.4 + (i % 5) * 0.35).toFixed(1);
    const o = (0.2 + (i % 6) * 0.12).toFixed(2);
    stars.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}"/>`);
  }
  // Bright stars with glow
  for (const [x, y, r] of [[320, 120, 2], [720, 80, 2.5], [1050, 180, 2], [180, 280, 1.8], [550, 220, 2.2], [900, 140, 1.6]]) {
    stars.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".9"/><circle cx="${x}" cy="${y}" r="${(r as number) * 4}" fill="#aac8ff" opacity=".06"/>`);
  }
  // Twinkling cross-stars
  for (const [x, y] of [[450, 160], [1180, 250], [680, 320]]) {
    stars.push(`<line x1="${(x as number) - 6}" y1="${y}" x2="${(x as number) + 6}" y2="${y}" stroke="#fff" stroke-width=".6" opacity=".7"/><line x1="${x}" y1="${(y as number) - 6}" x2="${x}" y2="${(y as number) + 6}" stroke="#fff" stroke-width=".6" opacity=".7"/>`);
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900">` +
    `<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#020810"/><stop offset="40%" stop-color="#061428"/><stop offset="70%" stop-color="#0c1e3a"/><stop offset="100%" stop-color="#142848"/></linearGradient>` +
    `<radialGradient id="moonGlow" cx=".5" cy=".5" r=".5"><stop offset="0%" stop-color="#ffe8a0" stop-opacity=".3"/><stop offset="60%" stop-color="#ffe8a0" stop-opacity=".08"/><stop offset="100%" stop-color="#ffe8a0" stop-opacity="0"/></radialGradient></defs>` +
    `<rect fill="url(#a)" width="1440" height="900"/>` +
    // Nebula glow
    `<ellipse cx="400" cy="300" rx="300" ry="200" fill="#1a0a3e" opacity=".15"/>` +
    `<ellipse cx="1100" cy="200" rx="250" ry="150" fill="#0a1848" opacity=".2"/>` +
    // Stars
    stars.join("") +
    // Crescent moon with glow
    `<circle cx="1200" cy="140" r="100" fill="url(#moonGlow)"/>` +
    `<circle cx="1200" cy="140" r="45" fill="#f0e6c0" opacity=".9"/>` +
    `<circle cx="1220" cy="125" r="38" fill="#061428"/>` +
    // Moon surface details
    `<circle cx="1188" cy="132" r="5" fill="#d8cca0" opacity=".3"/>` +
    `<circle cx="1198" cy="155" r="3" fill="#d8cca0" opacity=".25"/>` +
    `<circle cx="1180" cy="148" r="4" fill="#d8cca0" opacity=".2"/>` +
    // Gentle rolling hills/horizon
    `<path d="M0 780Q200 720 400 750Q600 780 800 740Q1000 700 1200 730Q1350 750 1440 720V900H0Z" fill="#0a1020" opacity=".6"/>` +
    `<path d="M0 820Q300 780 600 800Q900 820 1200 790Q1350 780 1440 800V900H0Z" fill="#080c18" opacity=".7"/>` +
    // Silhouetted trees on horizon
    `<g fill="#060e1a" opacity=".8">` +
    `<path d="M80 800l6-25 6 25Z"/><path d="M100 800l5-20 5 20Z"/>` +
    `<path d="M350 770l7-30 7 30Z"/><path d="M370 770l6-22 6 22Z"/><path d="M385 770l5-18 5 18Z"/>` +
    `<path d="M700 760l8-35 8 35Z"/><path d="M722 760l6-25 6 25Z"/>` +
    `<path d="M1050 750l7-28 7 28Z"/><path d="M1070 750l6-22 6 22Z"/><path d="M1090 750l5-18 5 18Z"/>` +
    `<path d="M1350 790l6-22 6 22Z"/><path d="M1370 790l5-18 5 18Z"/>` +
    `</g>` +
    `</svg>`
  );
}

function createBeachSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900">` +
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4db8d8"/><stop offset="40%" stop-color="#7ecce8"/><stop offset="55%" stop-color="#b5dff0"/><stop offset="65%" stop-color="#f0dcc0"/><stop offset="100%" stop-color="#e8cfa8"/></linearGradient>` +
    `<radialGradient id="sunGlow" cx=".5" cy=".5" r=".5"><stop offset="0%" stop-color="#fff4b0" stop-opacity=".4"/><stop offset="100%" stop-color="#fff4b0" stop-opacity="0"/></radialGradient></defs>` +
    `<rect fill="url(#sky)" width="1440" height="900"/>` +
    // Sun with glow
    `<circle cx="1150" cy="180" r="120" fill="url(#sunGlow)"/>` +
    `<circle cx="1150" cy="180" r="50" fill="#f9a825" opacity=".9"/>` +
    `<circle cx="1150" cy="180" r="60" fill="#f9a825" opacity=".15"/>` +
    // Sun rays
    `<g stroke="#f9a825" stroke-width="2" opacity=".15" stroke-linecap="round">` +
    `<line x1="1150" y1="100" x2="1150" y2="70"/><line x1="1150" y1="260" x2="1150" y2="290"/>` +
    `<line x1="1070" y1="180" x2="1040" y2="180"/><line x1="1230" y1="180" x2="1260" y2="180"/>` +
    `<line x1="1094" y1="124" x2="1074" y2="104"/><line x1="1206" y1="236" x2="1226" y2="256"/>` +
    `<line x1="1206" y1="124" x2="1226" y2="104"/><line x1="1094" y1="236" x2="1074" y2="256"/>` +
    `</g>` +
    // Seagulls
    `<g fill="none" stroke="#445" stroke-width="1.5" stroke-linecap="round" opacity=".5">` +
    `<path d="M300 200Q310 190 320 195Q330 190 340 200"/>` +
    `<path d="M360 180Q368 172 376 176Q384 172 392 180"/>` +
    `<path d="M800 160Q808 152 816 156Q824 152 832 160"/>` +
    `<path d="M850 140Q856 134 862 137Q868 134 874 140"/>` +
    `<path d="M1000 220Q1007 214 1014 217Q1021 214 1028 220"/>` +
    `</g>` +
    // Fluffy clouds
    `<g fill="#fff" opacity=".5"><ellipse cx="250" cy="140" rx="70" ry="28"/><ellipse cx="215" cy="128" rx="45" ry="22"/><ellipse cx="285" cy="130" rx="50" ry="24"/></g>` +
    `<g fill="#fff" opacity=".35"><ellipse cx="700" cy="120" rx="60" ry="22"/><ellipse cx="670" cy="110" rx="40" ry="18"/><ellipse cx="730" cy="112" rx="45" ry="20"/></g>` +
    // Ocean waves
    `<path d="M0 580Q80 560 160 580Q240 600 320 580Q400 560 480 580Q560 600 640 580Q720 560 800 580Q880 600 960 580Q1040 560 1120 580Q1200 600 1280 580Q1360 560 1440 580V900H0Z" fill="#1da8c0" opacity=".4"/>` +
    `<path d="M0 620Q100 600 200 620Q300 640 400 620Q500 600 600 620Q700 640 800 620Q900 600 1000 620Q1100 640 1200 620Q1300 600 1440 630V900H0Z" fill="#1898b0" opacity=".4"/>` +
    `<path d="M0 660Q120 645 240 660Q360 680 480 660Q600 645 720 660Q840 680 960 660Q1080 645 1200 660Q1320 680 1440 660V900H0Z" fill="#128898" opacity=".35"/>` +
    // Wave foam lines
    `<path d="M0 578Q60 562 120 578Q180 594 240 578" fill="none" stroke="#fff" stroke-width="1" opacity=".3"/>` +
    `<path d="M400 578Q460 562 520 578Q580 594 640 578" fill="none" stroke="#fff" stroke-width="1" opacity=".25"/>` +
    // Sand
    `<path d="M0 700Q200 690 400 695Q600 700 800 692Q1000 685 1200 695Q1350 700 1440 690V900H0Z" fill="#e8cfa8" opacity=".6"/>` +
    // Beach ball
    `<g transform="translate(400,660)">` +
    `<circle r="22" fill="#fff" opacity=".9"/>` +
    `<path d="M0-22A22 22 0 0 1 11 19L0 0Z" fill="#D02020" opacity=".8"/>` +
    `<path d="M11 19A22 22 0 0 1-19 11L0 0Z" fill="#1040C0" opacity=".8"/>` +
    `<path d="M-19 11A22 22 0 0 1-11-19L0 0Z" fill="#F0C020" opacity=".8"/>` +
    `<path d="M-11-19A22 22 0 0 1 0-22L0 0Z" fill="#10b981" opacity=".8"/>` +
    `<circle r="4" fill="#fff" opacity=".6"/>` +
    `</g>` +
    // Palm trees
    `<g opacity=".7">` +
    // Left palm
    `<path d="M120 690Q115 620 110 560" fill="none" stroke="#5a3a1a" stroke-width="6" stroke-linecap="round"/>` +
    `<g fill="#2d8a3e" opacity=".85">` +
    `<path d="M110 560Q80 530 40 540Q70 545 95 555Z"/>` +
    `<path d="M110 560Q75 550 50 570Q80 560 100 558Z"/>` +
    `<path d="M110 560Q130 525 170 520Q145 530 120 555Z"/>` +
    `<path d="M110 560Q140 545 165 555Q140 548 118 558Z"/>` +
    `<path d="M110 560Q100 520 108 490Q105 520 110 555Z"/>` +
    `</g>` +
    // Coconuts
    `<circle cx="110" cy="562" r="4" fill="#6a4a2a"/>` +
    `<circle cx="116" cy="558" r="3.5" fill="#6a4a2a"/>` +
    `</g>` +
    // Right palm (smaller, background)
    `<g opacity=".45">` +
    `<path d="M1340 700Q1338 650 1335 600" fill="none" stroke="#5a3a1a" stroke-width="5" stroke-linecap="round"/>` +
    `<g fill="#2d8a3e">` +
    `<path d="M1335 600Q1310 575 1280 580Q1300 582 1325 595Z"/>` +
    `<path d="M1335 600Q1360 575 1390 572Q1370 580 1345 595Z"/>` +
    `<path d="M1335 600Q1330 565 1335 540Q1333 568 1335 595Z"/>` +
    `</g></g>` +
    // Sand texture dots
    `<g fill="#c4a878" opacity=".3">` +
    `<circle cx="200" cy="720" r="1"/><circle cx="350" cy="730" r="1.2"/><circle cx="500" cy="715" r="1"/>` +
    `<circle cx="650" cy="725" r="1.3"/><circle cx="800" cy="710" r="1"/><circle cx="950" cy="728" r="1.2"/>` +
    `<circle cx="1100" cy="718" r="1"/><circle cx="1250" cy="722" r="1.3"/>` +
    `</g>` +
    `</svg>`
  );
}

function createUrbanSvg(): string {
  // Generate building windows
  const windows: string[] = [];
  const buildings = [
    // [x, topY, width, windowRows] for each building
    { x: 0, top: 400, w: 80, cols: 3 },
    { x: 80, top: 320, w: 60, cols: 2 },
    { x: 140, top: 450, w: 70, cols: 2 },
    { x: 220, top: 280, w: 90, cols: 3 },
    { x: 320, top: 350, w: 60, cols: 2 },
    { x: 380, top: 220, w: 80, cols: 3 },
    { x: 470, top: 380, w: 70, cols: 2 },
    { x: 550, top: 300, w: 60, cols: 2 },
    { x: 620, top: 180, w: 100, cols: 4 },  // Tallest tower
    { x: 730, top: 340, w: 70, cols: 2 },
    { x: 810, top: 260, w: 80, cols: 3 },
    { x: 900, top: 380, w: 60, cols: 2 },
    { x: 970, top: 300, w: 90, cols: 3 },
    { x: 1070, top: 240, w: 80, cols: 3 },
    { x: 1160, top: 360, w: 70, cols: 2 },
    { x: 1240, top: 280, w: 80, cols: 3 },
    { x: 1330, top: 340, w: 110, cols: 3 },
  ];
  const colors = ["#f0c020", "#88ccff", "#f43f5e", "#ffffff"];
  let seed = 42;
  for (const b of buildings) {
    const spacing = b.w / (b.cols + 1);
    for (let col = 0; col < b.cols; col++) {
      const wx = b.x + spacing * (col + 1) - 2;
      for (let row = 0; row < Math.floor((700 - b.top) / 30); row++) {
        const wy = b.top + 15 + row * 30;
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const on = (seed % 10) > 3; // ~60% lit
        if (on) {
          const c = colors[seed % colors.length];
          const o = (0.3 + (seed % 5) * 0.1).toFixed(1);
          windows.push(`<rect x="${wx}" y="${wy}" width="5" height="7" fill="${c}" opacity="${o}"/>`);
        }
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900">` +
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0a0a18"/><stop offset="40%" stop-color="#10101e"/><stop offset="100%" stop-color="#1a1a2e"/></linearGradient></defs>` +
    `<rect fill="url(#sky)" width="1440" height="900"/>` +
    // Distant city glow
    `<ellipse cx="720" cy="700" rx="600" ry="200" fill="#f43f5e" opacity=".03"/>` +
    `<ellipse cx="720" cy="700" rx="400" ry="120" fill="#f0c020" opacity=".04"/>` +
    // Stars (few visible through light pollution)
    `<g fill="#fff" opacity=".3"><circle cx="200" cy="60" r=".8"/><circle cx="500" cy="100" r=".6"/><circle cx="1000" cy="80" r=".7"/><circle cx="1300" cy="50" r=".8"/><circle cx="700" cy="40" r=".5"/></g>` +
    // Building silhouettes (back layer - darker, taller)
    `<g fill="#0e0e1c" stroke="#1a1a30" stroke-width=".5">` +
    buildings.map(b => `<rect x="${b.x}" y="${b.top}" width="${b.w}" height="${700 - b.top}"/>`).join("") +
    `</g>` +
    // Antenna/spire on tallest building
    `<line x1="670" y1="180" x2="670" y2="140" stroke="#333" stroke-width="2"/>` +
    `<circle cx="670" cy="138" r="2" fill="#f43f5e" opacity=".8"/>` +
    // Another antenna
    `<line x1="260" y1="280" x2="260" y2="255" stroke="#333" stroke-width="1.5"/>` +
    `<circle cx="260" cy="253" r="1.5" fill="#f43f5e" opacity=".6"/>` +
    // Windows
    windows.join("") +
    // Street level
    `<rect y="700" width="1440" height="200" fill="#0c0c14"/>` +
    // Road
    `<rect y="720" width="1440" height="80" fill="#0f0f18"/>` +
    `<line x1="0" y1="760" x2="1440" y2="760" stroke="#444" stroke-width="1.5" stroke-dasharray="25 18" opacity=".6"/>` +
    // Curb / sidewalk edge
    `<line x1="0" y1="720" x2="1440" y2="720" stroke="#f43f5e" stroke-width="1.5" opacity=".25"/>` +
    `<line x1="0" y1="800" x2="1440" y2="800" stroke="#f43f5e" stroke-width="1" opacity=".15"/>` +
    // Street lights
    `<g stroke="#555" stroke-width="2" opacity=".6">` +
    `<line x1="200" y1="700" x2="200" y2="660"/><circle cx="200" cy="658" r="4" fill="#f0c020" opacity=".5"/>` +
    `<ellipse cx="200" cy="720" rx="20" ry="3" fill="#f0c020" opacity=".1"/>` +
    `<line x1="600" y1="700" x2="600" y2="660"/><circle cx="600" cy="658" r="4" fill="#f0c020" opacity=".5"/>` +
    `<ellipse cx="600" cy="720" rx="20" ry="3" fill="#f0c020" opacity=".1"/>` +
    `<line x1="1000" y1="700" x2="1000" y2="660"/><circle cx="1000" cy="658" r="4" fill="#f0c020" opacity=".5"/>` +
    `<ellipse cx="1000" cy="720" rx="20" ry="3" fill="#f0c020" opacity=".1"/>` +
    `</g>` +
    `</svg>`
  );
}

function createSnowySvg(): string {
  // Snowflakes scattered
  const flakes: string[] = [];
  for (let i = 0; i < 40; i++) {
    const x = (i * 59 + 23) % 1440;
    const y = (i * 37 + 11) % 700;
    const sz = 2 + (i % 4) * 1.5;
    const o = (0.15 + (i % 5) * 0.06).toFixed(2);
    flakes.push(
      `<g transform="translate(${x},${y})" opacity="${o}">` +
      `<line x1="0" y1="-${sz}" x2="0" y2="${sz}" stroke="#89a7c4" stroke-width=".7"/>` +
      `<line x1="-${(sz * 0.866).toFixed(1)}" y1="-${(sz * 0.5).toFixed(1)}" x2="${(sz * 0.866).toFixed(1)}" y2="${(sz * 0.5).toFixed(1)}" stroke="#89a7c4" stroke-width=".7"/>` +
      `<line x1="-${(sz * 0.866).toFixed(1)}" y1="${(sz * 0.5).toFixed(1)}" x2="${(sz * 0.866).toFixed(1)}" y2="-${(sz * 0.5).toFixed(1)}" stroke="#89a7c4" stroke-width=".7"/>` +
      `</g>`,
    );
  }

  // Snow-covered pine trees
  function pineTree(x: number, baseY: number, h: number, snowOpacity: number): string {
    const w = h * 0.5;
    return (
      // Trunk
      `<rect x="${x - 3}" y="${baseY - h * 0.15}" width="6" height="${h * 0.2}" fill="#5a3a1a" opacity=".5"/>` +
      // Tree body (3 layers)
      `<path d="M${x} ${baseY - h}L${x + w * 0.4} ${baseY - h * 0.6} ${x - w * 0.4} ${baseY - h * 0.6}Z" fill="#2a5a3a" opacity=".7"/>` +
      `<path d="M${x} ${baseY - h * 0.75}L${x + w * 0.55} ${baseY - h * 0.35} ${x - w * 0.55} ${baseY - h * 0.35}Z" fill="#24503a" opacity=".75"/>` +
      `<path d="M${x} ${baseY - h * 0.5}L${x + w * 0.7} ${baseY - h * 0.05} ${x - w * 0.7} ${baseY - h * 0.05}Z" fill="#1e4630" opacity=".8"/>` +
      // Snow on branches
      `<path d="M${x - w * 0.35} ${baseY - h * 0.6}Q${x} ${baseY - h * 0.65} ${x + w * 0.35} ${baseY - h * 0.6}" fill="none" stroke="#e8f0f8" stroke-width="3" opacity="${snowOpacity}"/>` +
      `<path d="M${x - w * 0.5} ${baseY - h * 0.35}Q${x} ${baseY - h * 0.4} ${x + w * 0.5} ${baseY - h * 0.35}" fill="none" stroke="#e8f0f8" stroke-width="3.5" opacity="${snowOpacity}"/>` +
      `<path d="M${x - w * 0.65} ${baseY - h * 0.08}Q${x} ${baseY - h * 0.14} ${x + w * 0.65} ${baseY - h * 0.08}" fill="none" stroke="#e8f0f8" stroke-width="4" opacity="${snowOpacity}"/>` +
      // Snow cap on top
      `<ellipse cx="${x}" cy="${baseY - h}" rx="${w * 0.2}" ry="4" fill="#e8f0f8" opacity="${snowOpacity}"/>`
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900">` +
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c8d8e8"/><stop offset="50%" stop-color="#d8e4f0"/><stop offset="100%" stop-color="#e8eef4"/></linearGradient></defs>` +
    `<rect fill="url(#sky)" width="1440" height="900"/>` +
    // Distant mountains
    `<path d="M0 550L120 380 200 440 320 300 420 380 500 320 620 420 720 350 850 420 950 300 1050 380 1150 320 1280 400 1380 320 1440 400V700H0Z" fill="#9ab0c0" opacity=".3"/>` +
    `<path d="M0 600L100 450 220 520 350 400 450 480 580 380 700 480 820 400 950 470 1050 380 1180 460 1300 400 1440 470V700H0Z" fill="#8aa0b4" opacity=".35"/>` +
    // Snow caps on peaks
    `<path d="M320 300l30 20-20 5-25 0Z" fill="#f4f8fc" opacity=".85"/>` +
    `<path d="M500 320l25 18-18 4-20 0Z" fill="#f4f8fc" opacity=".85"/>` +
    `<path d="M950 300l30 20-20 5-25 0Z" fill="#f4f8fc" opacity=".85"/>` +
    `<path d="M1380 320l25 15-15 4-22 0Z" fill="#f4f8fc" opacity=".85"/>` +
    // Snow ground
    `<path d="M0 680Q200 665 400 675Q600 685 800 670Q1000 660 1200 672Q1350 680 1440 668V900H0Z" fill="#f0f4f8" opacity=".9"/>` +
    `<rect y="700" width="1440" height="200" fill="#eef2f8"/>` +
    // Snow drifts
    `<ellipse cx="300" cy="700" rx="100" ry="12" fill="#f8fafc" opacity=".6"/>` +
    `<ellipse cx="800" cy="695" rx="80" ry="10" fill="#f8fafc" opacity=".5"/>` +
    `<ellipse cx="1200" cy="698" rx="90" ry="11" fill="#f8fafc" opacity=".6"/>` +
    // Forest of snowy pine trees
    pineTree(80, 690, 100, 0.8) +
    pineTree(150, 695, 80, 0.75) +
    pineTree(220, 688, 110, 0.85) +
    pineTree(300, 692, 70, 0.7) +
    pineTree(500, 690, 90, 0.8) +
    pineTree(560, 694, 75, 0.7) +
    pineTree(900, 686, 105, 0.85) +
    pineTree(970, 692, 80, 0.75) +
    pineTree(1050, 688, 95, 0.8) +
    pineTree(1200, 694, 70, 0.7) +
    pineTree(1280, 690, 100, 0.8) +
    pineTree(1380, 695, 85, 0.75) +
    // Snowflakes
    flakes.join("") +
    `</svg>`
  );
}

function createSunnySvg(): string {
  // Sun rays
  const rays: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * 22.5 * Math.PI) / 180;
    const inner = 75;
    const outer = i % 2 === 0 ? 200 : 150;
    const w = i % 2 === 0 ? 4 : 2.5;
    rays.push(
      `<line x1="${(280 + Math.cos(a) * inner).toFixed(0)}" y1="${(220 + Math.sin(a) * inner).toFixed(0)}" x2="${(280 + Math.cos(a) * outer).toFixed(0)}" y2="${(220 + Math.sin(a) * outer).toFixed(0)}" stroke="#f59e0b" stroke-width="${w}" opacity=".18" stroke-linecap="round"/>`,
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900">` +
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fde68a"/><stop offset="30%" stop-color="#fef3c7"/><stop offset="60%" stop-color="#fff7ed"/><stop offset="100%" stop-color="#ffedd5"/></linearGradient>` +
    `<radialGradient id="sunGlow" cx=".5" cy=".5" r=".5"><stop offset="0%" stop-color="#fbbf24" stop-opacity=".35"/><stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/></radialGradient></defs>` +
    `<rect fill="url(#sky)" width="1440" height="900"/>` +
    // Large warm sun with glow
    `<circle cx="280" cy="220" r="180" fill="url(#sunGlow)"/>` +
    rays.join("") +
    `<circle cx="280" cy="220" r="65" fill="#f59e0b" opacity=".85"/>` +
    `<circle cx="280" cy="220" r="80" fill="#f59e0b" opacity=".12"/>` +
    // Happy sun face (subtle)
    `<circle cx="260" cy="210" r="5" fill="#d97706" opacity=".3"/>` +
    `<circle cx="300" cy="210" r="5" fill="#d97706" opacity=".3"/>` +
    `<path d="M258 232Q280 248 302 232" fill="none" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" opacity=".25"/>` +
    // Fluffy clouds
    `<g fill="#fff" opacity=".55"><ellipse cx="650" cy="180" rx="85" ry="32"/><ellipse cx="610" cy="165" rx="55" ry="28"/><ellipse cx="695" cy="168" rx="60" ry="25"/><ellipse cx="650" cy="155" rx="40" ry="20"/></g>` +
    `<g fill="#fff" opacity=".4"><ellipse cx="1050" cy="250" rx="70" ry="26"/><ellipse cx="1015" cy="238" rx="45" ry="22"/><ellipse cx="1085" cy="240" rx="50" ry="20"/></g>` +
    `<g fill="#fff" opacity=".3"><ellipse cx="1300" cy="160" rx="55" ry="20"/><ellipse cx="1275" cy="150" rx="35" ry="16"/><ellipse cx="1325" cy="152" rx="40" ry="18"/></g>` +
    // Gentle rolling hills
    `<path d="M0 700Q200 650 400 680Q600 710 800 670Q1000 640 1200 680Q1350 700 1440 670V900H0Z" fill="#c4a060" opacity=".15"/>` +
    `<path d="M0 750Q300 720 600 740Q900 760 1200 730Q1350 720 1440 740V900H0Z" fill="#c4a060" opacity=".1"/>` +
    // Sunflowers in field
    `<g opacity=".6">` +
    `<g transform="translate(800,680)"><line x1="0" y1="0" x2="0" y2="40" stroke="#5a8a2a" stroke-width="2.5"/><circle r="10" fill="#f59e0b"/><circle r="5" fill="#92400e" opacity=".7"/><ellipse cx="-8" cy="20" rx="6" ry="3" fill="#4a7a20" transform="rotate(-30 -8 20)"/></g>` +
    `<g transform="translate(850,690)"><line x1="0" y1="0" x2="0" y2="35" stroke="#5a8a2a" stroke-width="2"/><circle r="8" fill="#f59e0b"/><circle r="4" fill="#92400e" opacity=".7"/><ellipse cx="7" cy="18" rx="5" ry="2.5" fill="#4a7a20" transform="rotate(25 7 18)"/></g>` +
    `<g transform="translate(880,685)"><line x1="0" y1="0" x2="0" y2="38" stroke="#5a8a2a" stroke-width="2.5"/><circle r="9" fill="#fbbf24"/><circle r="4.5" fill="#92400e" opacity=".7"/></g>` +
    `<g transform="translate(760,688)"><line x1="0" y1="0" x2="0" y2="36" stroke="#5a8a2a" stroke-width="2"/><circle r="7.5" fill="#f59e0b"/><circle r="3.5" fill="#92400e" opacity=".7"/></g>` +
    `</g>` +
    // Butterflies
    `<g opacity=".4">` +
    `<g transform="translate(500,350)"><path d="M0 0Q-8-10-5-18Q0-12 0 0" fill="#f43f5e"/><path d="M0 0Q8-10 5-18Q0-12 0 0" fill="#f43f5e"/><path d="M0 0Q-6 5-4 12Q0 6 0 0" fill="#ec4899"/><path d="M0 0Q6 5 4 12Q0 6 0 0" fill="#ec4899"/></g>` +
    `<g transform="translate(1100,300)"><path d="M0 0Q-6-8-4-14Q0-9 0 0" fill="#fbbf24"/><path d="M0 0Q6-8 4-14Q0-9 0 0" fill="#fbbf24"/><path d="M0 0Q-5 4-3 9Q0 5 0 0" fill="#f59e0b"/><path d="M0 0Q5 4 3 9Q0 5 0 0" fill="#f59e0b"/></g>` +
    `</g>` +
    // Birds in distance
    `<g fill="none" stroke="#a07040" stroke-width="1.2" stroke-linecap="round" opacity=".3">` +
    `<path d="M950 150Q958 142 966 148Q974 142 982 150"/>` +
    `<path d="M1000 140Q1006 134 1012 138Q1018 134 1024 140"/>` +
    `</g>` +
    `</svg>`
  );
}

function createMountainsSvg(): string {
  // Stars
  const stars: string[] = [];
  for (let i = 0; i < 50; i++) {
    stars.push(
      `<circle cx="${(i * 59 + 17) % 1440}" cy="${(i * 31 + 5) % 350}" r="${(0.4 + (i % 4) * 0.25).toFixed(1)}" fill="#fff" opacity="${(0.15 + (i % 5) * 0.08).toFixed(2)}"/>`,
    );
  }
  // Bright stars
  for (const [x, y] of [[300, 80], [800, 60], [1100, 120], [500, 150]]) {
    stars.push(`<circle cx="${x}" cy="${y}" r="1.2" fill="#fff" opacity=".7"/>`);
  }

  // Pine tree helper
  function pine(x: number, baseY: number, h: number, shade: string): string {
    const w = h * 0.35;
    return (
      `<rect x="${x - 2}" y="${baseY - h * 0.1}" width="4" height="${h * 0.15}" fill="#1a1208" opacity=".6"/>` +
      `<path d="M${x} ${baseY - h}L${x + w * 0.35} ${baseY - h * 0.65} ${x - w * 0.35} ${baseY - h * 0.65}Z" fill="${shade}" opacity=".85"/>` +
      `<path d="M${x} ${baseY - h * 0.72}L${x + w * 0.5} ${baseY - h * 0.35} ${x - w * 0.5} ${baseY - h * 0.35}Z" fill="${shade}" opacity=".9"/>` +
      `<path d="M${x} ${baseY - h * 0.45}L${x + w * 0.65} ${baseY - h * 0.02} ${x - w * 0.65} ${baseY - h * 0.02}Z" fill="${shade}" opacity=".95"/>`
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900">` +
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#071410"/><stop offset="30%" stop-color="#0a1e14"/><stop offset="60%" stop-color="#0f2818"/><stop offset="100%" stop-color="#1a3820"/></linearGradient>` +
    `<linearGradient id="mtn1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1a3828"/><stop offset="100%" stop-color="#0f2418"/></linearGradient>` +
    `<linearGradient id="mtn2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1e4430"/><stop offset="100%" stop-color="#142e1e"/></linearGradient></defs>` +
    `<rect fill="url(#sky)" width="1440" height="900"/>` +
    // Stars
    stars.join("") +
    // Moon
    `<circle cx="1200" cy="100" r="25" fill="#e8e0c0" opacity=".6"/>` +
    `<circle cx="1210" cy="92" r="22" fill="#0a1e14"/>` +
    // Far mountains (blue-grey, misty)
    `<path d="M0 520L180 340 280 400 420 280 520 360 620 300 780 420 900 320 1020 380 1140 280 1280 360 1380 300 1440 380V600H0Z" fill="#0c2218" opacity=".5"/>` +
    // Snow-capped peaks on far mountains
    `<path d="M420 280l25 25-15 5-22-2Z" fill="#d0e0d0" opacity=".4"/>` +
    `<path d="M620 300l22 22-14 4-18-2Z" fill="#d0e0d0" opacity=".4"/>` +
    `<path d="M1140 280l25 25-15 5-22-2Z" fill="#d0e0d0" opacity=".4"/>` +
    // Mid mountains
    `<path d="M0 600L100 440 240 520 380 380 500 470 650 360 800 470 940 380 1080 460 1200 370 1340 450 1440 400V650H0Z" fill="url(#mtn1)"/>` +
    // Snow caps mid
    `<path d="M380 380l28 30-18 5-25-3Z" fill="#c8d8c8" opacity=".5"/>` +
    `<path d="M650 360l30 32-20 5-28-3Z" fill="#c8d8c8" opacity=".5"/>` +
    `<path d="M1200 370l26 28-16 5-24-3Z" fill="#c8d8c8" opacity=".5"/>` +
    // Near mountains (larger, more detailed)
    `<path d="M0 680L120 480 260 570 400 430 540 540 700 400 860 520 1000 430 1140 530 1280 420 1400 500 1440 460V720H0Z" fill="url(#mtn2)"/>` +
    // Near snow caps
    `<path d="M400 430l35 40-24 6-30-4Z" fill="#b8d0c0" opacity=".6"/>` +
    `<path d="M700 400l38 42-26 6-32-4Z" fill="#b8d0c0" opacity=".6"/>` +
    `<path d="M1280 420l32 38-22 6-28-4Z" fill="#b8d0c0" opacity=".6"/>` +
    // Valley/ground
    `<path d="M0 700Q300 680 600 695Q900 710 1200 690Q1350 685 1440 700V900H0Z" fill="#0a1a10" opacity=".9"/>` +
    `<rect y="720" width="1440" height="180" fill="#081408"/>` +
    // Forest of pine trees at base
    `<g>` +
    pine(60, 710, 80, "#0a2010") +
    pine(100, 715, 65, "#0c2414") +
    pine(150, 708, 90, "#0a2010") +
    pine(210, 712, 70, "#0c2414") +
    pine(280, 705, 95, "#0a2010") +
    pine(340, 714, 60, "#0c2414") +
    pine(420, 710, 85, "#0a2010") +
    pine(480, 715, 70, "#0c2414") +
    pine(550, 708, 90, "#0a2010") +
    pine(620, 712, 75, "#0c2414") +
    pine(700, 706, 95, "#0a2010") +
    pine(760, 714, 65, "#0c2414") +
    pine(830, 710, 85, "#0a2010") +
    pine(900, 715, 70, "#0c2414") +
    pine(970, 708, 90, "#0a2010") +
    pine(1040, 712, 75, "#0c2414") +
    pine(1120, 706, 88, "#0a2010") +
    pine(1190, 714, 65, "#0c2414") +
    pine(1260, 710, 85, "#0a2010") +
    pine(1340, 708, 92, "#0a2010") +
    pine(1400, 712, 70, "#0c2414") +
    `</g>` +
    // Mist in valley
    `<ellipse cx="400" cy="710" rx="200" ry="15" fill="#1a3020" opacity=".3"/>` +
    `<ellipse cx="1000" cy="708" rx="180" ry="12" fill="#1a3020" opacity=".25"/>` +
    // Winding river
    `<path d="M350 900Q380 820 450 780Q550 740 650 760Q780 780 850 810Q950 850 1000 900" fill="none" stroke="#1a4030" stroke-width="4" opacity=".4"/>` +
    `<path d="M350 900Q380 820 450 780Q550 740 650 760Q780 780 850 810Q950 850 1000 900" fill="none" stroke="#2a5840" stroke-width="2" opacity=".3"/>` +
    `</svg>`
  );
}

// ── Pre-computed SVG data URIs ──────────────────────────────────────

const ORIGINAL_PREVIEW_URI = svgToDataUri(createOriginalPreviewSvg());
const NIGHT_SVG_URI = svgToDataUri(createNightSvg());
const BEACH_SVG_URI = svgToDataUri(createBeachSvg());
const URBAN_SVG_URI = svgToDataUri(createUrbanSvg());
const SNOWY_SVG_URI = svgToDataUri(createSnowySvg());
const SUNNY_SVG_URI = svgToDataUri(createSunnySvg());
const MOUNTAINS_SVG_URI = svgToDataUri(createMountainsSvg());

// ── Theme Presets ───────────────────────────────────────────────────

interface ThemePreset {
  id: TripThemeColorScheme;
  name: string;
  tagline: string;
  bgColor: string;
  previewUri: string;
  bgUri: string;
  defaultAccent: string;
  defaultFont: string;
  defaultEffect: TripThemeEffect;
  surfaceColor: string;
  surfaceElevatedColor: string;
  borderColor: string;
}

const THEME_PRESETS: ThemePreset[] = [
  {
    id: "original",
    name: "Original",
    tagline: "Classic Bauhaus",
    bgColor: "#F0F0F0",
    previewUri: ORIGINAL_PREVIEW_URI,
    bgUri: "",
    defaultAccent: "#D02020",
    defaultFont: "",
    defaultEffect: "none",
    surfaceColor: "",
    surfaceElevatedColor: "",
    borderColor: "",
  },
  {
    id: "night",
    name: "Night",
    tagline: "Starlit dreams",
    bgColor: "#0a1020",
    previewUri: NIGHT_SVG_URI,
    bgUri: NIGHT_SVG_URI,
    defaultAccent: "#8b5cf6",
    defaultFont: "Space Grotesk",
    defaultEffect: "sparkles",
    surfaceColor: "#141428",
    surfaceElevatedColor: "#1a1a38",
    borderColor: "#ffffff",
  },
  {
    id: "beach",
    name: "Beach",
    tagline: "Ocean breeze",
    bgColor: "#c8dce8",
    previewUri: BEACH_SVG_URI,
    bgUri: BEACH_SVG_URI,
    defaultAccent: "#0891b2",
    defaultFont: "Quicksand",
    defaultEffect: "none",
    surfaceColor: "#fef8f0",
    surfaceElevatedColor: "#fff5e6",
    borderColor: "#1a6070",
  },
  {
    id: "urban",
    name: "Urban",
    tagline: "City lights",
    bgColor: "#12121e",
    previewUri: URBAN_SVG_URI,
    bgUri: URBAN_SVG_URI,
    defaultAccent: "#f43f5e",
    defaultFont: "Urbanist",
    defaultEffect: "none",
    surfaceColor: "#1a1a2e",
    surfaceElevatedColor: "#22223a",
    borderColor: "#ffffff",
  },
  {
    id: "snowy",
    name: "Snowy",
    tagline: "Winter serenity",
    bgColor: "#dce8f0",
    previewUri: SNOWY_SVG_URI,
    bgUri: SNOWY_SVG_URI,
    defaultAccent: "#3b82f6",
    defaultFont: "Lora",
    defaultEffect: "snow",
    surfaceColor: "#f8fafc",
    surfaceElevatedColor: "#f0f4f8",
    borderColor: "#4a6a80",
  },
  {
    id: "sunny",
    name: "Sunny",
    tagline: "Golden warmth",
    bgColor: "#fff0d8",
    previewUri: SUNNY_SVG_URI,
    bgUri: SUNNY_SVG_URI,
    defaultAccent: "#ea580c",
    defaultFont: "Nunito",
    defaultEffect: "confetti",
    surfaceColor: "#fffbf5",
    surfaceElevatedColor: "#fff7ed",
    borderColor: "#a05020",
  },
  {
    id: "mountains",
    name: "Mountains",
    tagline: "Into the wild",
    bgColor: "#0f2418",
    previewUri: MOUNTAINS_SVG_URI,
    bgUri: MOUNTAINS_SVG_URI,
    defaultAccent: "#10b981",
    defaultFont: "Cabin",
    defaultEffect: "fireflies",
    surfaceColor: "#142218",
    surfaceElevatedColor: "#1a2e1e",
    borderColor: "#ffffff",
  },
];

// ── Fonts ───────────────────────────────────────────────────────────

const THEME_FONTS = [
  { label: "Default (Outfit)", value: "" },
  { label: "Space Grotesk", value: "Space Grotesk" },
  { label: "Quicksand", value: "Quicksand" },
  { label: "Urbanist", value: "Urbanist" },
  { label: "Lora", value: "Lora" },
  { label: "Nunito", value: "Nunito" },
  { label: "Cabin", value: "Cabin" },
  { label: "Josefin Sans", value: "Josefin Sans" },
] as const;

// ── Accent Colors ───────────────────────────────────────────────────

const ACCENT_COLORS = [
  { name: "Red", value: "#D02020" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Cyan", value: "#0891b2" },
  { name: "Emerald", value: "#10b981" },
  { name: "Orange", value: "#ea580c" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Gold", value: "#eab308" },
  { name: "Pink", value: "#ec4899" },
  { name: "Slate", value: "#64748b" },
] as const;

// ── Effects ─────────────────────────────────────────────────────────

const EFFECT_OPTIONS: { value: TripThemeEffect; label: string }[] = [
  { value: "none", label: "None" },
  { value: "confetti", label: "Confetti" },
  { value: "sparkles", label: "Sparkles" },
  { value: "snow", label: "Snow" },
  { value: "fireflies", label: "Fireflies" },
  { value: "aurora", label: "Aurora" },
];

// ── Contrast Utilities ──────────────────────────────────────────────

function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrastColors(bgHex: string) {
  const isDark = getLuminance(bgHex) < 0.4;
  return {
    textPrimary: isDark ? "#fafafa" : "#121212",
    textSecondary: isDark ? "#a1a1aa" : "#666666",
    surfaceForeground: isDark ? "#fafafa" : "#121212",
  };
}

function getButtonTextColor(accentHex: string): string {
  return getLuminance(accentHex) > 0.4 ? "#121212" : "#ffffff";
}

// ── Theme Builder ───────────────────────────────────────────────────

function buildThemeFromState(
  scheme: TripThemeColorScheme,
  font: string,
  accentColor: string,
  effect: TripThemeEffect,
): TripTheme {
  if (scheme === "original") {
    const theme: TripTheme = { color_scheme: "original" };
    if (font) theme.font = { display: font, body: font };
    if (accentColor !== "#D02020") theme.accent_color = accentColor;
    if (effect !== "none") theme.effect = effect;
    return theme;
  }

  const preset = THEME_PRESETS.find((p) => p.id === scheme);
  if (!preset) return {};

  const contrast = getContrastColors(preset.bgColor);
  const activeFont = font || preset.defaultFont;

  return {
    color_scheme: scheme,
    background: {
      type: "image",
      value: preset.bgUri,
      overlay_opacity: 0,
    },
    font: activeFont ? { display: activeFont, body: activeFont } : undefined,
    accent_color: accentColor,
    effect,
    surface_color: preset.surfaceColor,
    surface_elevated_color: preset.surfaceElevatedColor,
    surface_foreground: contrast.surfaceForeground,
    text_primary: contrast.textPrimary,
    text_secondary: contrast.textSecondary,
    border_color: preset.borderColor,
  };
}

// ── Component ───────────────────────────────────────────────────────

type TripThemeEditorProps = {
  initialTheme: TripTheme | null;
  tripId: string;
  tripName: string;
};

export default function TripThemeEditor({
  initialTheme,
  tripId,
  tripName,
}: TripThemeEditorProps) {
  const initialScheme = initialTheme?.color_scheme ?? "original";
  const initialPreset = THEME_PRESETS.find((p) => p.id === initialScheme);

  const [colorScheme, setColorScheme] =
    useState<TripThemeColorScheme>(initialScheme);
  const [font, setFont] = useState(
    () => initialTheme?.font?.display ?? initialPreset?.defaultFont ?? "",
  );
  const [accentColor, setAccentColor] = useState(
    () =>
      initialTheme?.accent_color ?? initialPreset?.defaultAccent ?? "#D02020",
  );
  const [effect, setEffect] = useState<TripThemeEffect>(
    () => initialTheme?.effect ?? initialPreset?.defaultEffect ?? "none",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load all fonts for the selector preview
  useEffect(() => {
    const families = THEME_FONTS.filter((f) => f.value)
      .map((f) => `family=${f.value.replace(/ /g, "+")}:wght@400;500;700`)
      .join("&");
    if (!families) return;
    const link = document.createElement("link");
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    link.rel = "stylesheet";
    link.setAttribute("data-theme-editor-fonts", "true");
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, []);

  const theme = useMemo(
    () => buildThemeFromState(colorScheme, font, accentColor, effect),
    [colorScheme, font, accentColor, effect],
  );

  const handleSchemeChange = (scheme: TripThemeColorScheme) => {
    const preset = THEME_PRESETS.find((p) => p.id === scheme)!;
    setColorScheme(scheme);
    setFont(preset.defaultFont);
    setAccentColor(preset.defaultAccent);
    setEffect(preset.defaultEffect);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/trip/${tripId}/theme`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Failed to save theme.",
        );
      }
      window.location.href = `/trip/${tripId}`;
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not save theme. Try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setColorScheme("original");
    setFont("");
    setAccentColor("#D02020");
    setEffect("none");
  };

  const isPresetAccent = ACCENT_COLORS.some(
    (c) => c.value.toLowerCase() === accentColor.toLowerCase(),
  );
  const btnTextColor = getButtonTextColor(accentColor);

  return (
    <TripThemeProvider applyToAppNavigation theme={theme}>
      <BackgroundEffects effect={theme.effect ?? "none"} />
      <main className="relative z-10 min-h-screen px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-10">
        <div className="mx-auto max-w-4xl space-y-10">
          {/* ── Header ──────────────────────────────────────── */}
          <div>
            <Link
              href={`/trip/${tripId}`}
              className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to trip
            </Link>
            <h1 className="mt-3 font-display text-3xl font-black uppercase tracking-tight text-[var(--foreground)] sm:text-4xl">
              Customize Theme
            </h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Set the vibe for <strong>{tripName}</strong>. Everyone on the trip
              will see this.
            </p>
          </div>

          {/* ── Color Scheme ────────────────────────────────── */}
          <section>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Color Scheme
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSchemeChange(preset.id)}
                  className={`group relative h-32 overflow-hidden border-2 transition-all duration-200 sm:h-40 ${
                    colorScheme === preset.id
                      ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30"
                      : "border-[var(--border)] hover:border-[var(--foreground)]/60"
                  }`}
                  style={
                    colorScheme === preset.id
                      ? {
                          boxShadow: `4px 4px 0px 0px ${accentColor}`,
                        }
                      : undefined
                  }
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                    style={{
                      backgroundImage: `url(${preset.previewUri})`,
                      backgroundColor: preset.bgColor,
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-sm font-bold uppercase tracking-wider text-white">
                      {preset.name}
                    </p>
                    <p className="text-[10px] tracking-wide text-white/70">
                      {preset.tagline}
                    </p>
                  </div>
                  {colorScheme === preset.id && (
                    <div
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center border border-white/50"
                      style={{ backgroundColor: accentColor }}
                    >
                      <Check className="h-3.5 w-3.5" style={{ color: btnTextColor }} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* ── Font ────────────────────────────────────────── */}
          <section>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Font
            </h2>
            <div className="flex flex-wrap gap-2">
              {THEME_FONTS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFont(f.value)}
                  className={`border-2 px-4 py-2 text-sm font-medium transition ${
                    font === f.value
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--foreground)]"
                      : "border-[var(--border)] bg-[var(--surface)]/80 text-[var(--foreground)] hover:border-[var(--foreground)]/50"
                  }`}
                  style={
                    f.value
                      ? { fontFamily: `"${f.value}", sans-serif` }
                      : undefined
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
          </section>

          {/* ── Accent Color ────────────────────────────────── */}
          <section>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Accent Color
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setAccentColor(c.value)}
                  aria-label={c.name}
                  className={`relative h-10 w-10 border-2 transition-all duration-150 ${
                    accentColor.toLowerCase() === c.value.toLowerCase()
                      ? "scale-110 border-[var(--foreground)]"
                      : "border-transparent hover:scale-105 hover:border-[var(--foreground)]/40"
                  }`}
                  style={{ backgroundColor: c.value }}
                >
                  {accentColor.toLowerCase() === c.value.toLowerCase() && (
                    <Check
                      className="absolute inset-0 m-auto h-5 w-5 drop-shadow-sm"
                      style={{ color: getButtonTextColor(c.value) }}
                    />
                  )}
                </button>
              ))}
              <div className="flex items-center gap-2 border-l-2 border-[var(--border)] pl-3">
                <label className="relative cursor-pointer">
                  <input
                    type="color"
                    className="h-10 w-10 cursor-pointer border-2 border-[var(--border)] bg-transparent"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                  />
                </label>
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  {!isPresetAccent ? accentColor : "Custom"}
                </span>
              </div>
            </div>
          </section>

          {/* ── Special Effect ──────────────────────────────── */}
          <section>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Special Effect
            </h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {EFFECT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEffect(opt.value)}
                  className={`border-2 px-3 py-3 text-center text-sm font-bold uppercase tracking-wider transition ${
                    effect === opt.value
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--foreground)]"
                      : "border-[var(--border)] bg-[var(--surface)]/80 text-[var(--foreground)] hover:border-[var(--foreground)]/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* ── Live Preview Panel ──────────────────────────── */}
          <section className="overflow-hidden border-2 border-[var(--border)]">
            <div className="border-b-2 border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--foreground)]">
                Live Preview
              </h2>
            </div>
            <div className="relative min-h-[340px] overflow-hidden sm:min-h-[380px]">
              {/* Preview background */}
              {colorScheme !== "original" && (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: theme.background?.value
                      ? `url(${theme.background.value})`
                      : undefined,
                  }}
                />
              )}
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor:
                    colorScheme === "original"
                      ? "#F0F0F0"
                      : undefined,
                }}
              />
              <BackgroundEffects effect={effect} />

              {/* Mock navigation bar */}
              <div
                className="relative flex items-center gap-3 border-b-2 px-4 py-2"
                style={{
                  borderColor: theme.border_color
                    ? theme.border_color + "40"
                    : "var(--border)",
                  backgroundColor: theme.surface_color || "var(--surface)",
                }}
              >
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-[#D02020]" />
                  <div className="h-3 w-3 bg-[#1040C0]" />
                  <div
                    className="h-3 w-3"
                    style={{
                      clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
                      backgroundColor: "#F0C020",
                    }}
                  />
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    color: theme.text_primary || "var(--foreground)",
                  }}
                >
                  Trips
                </span>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: accentColor }}
                >
                  Current Trip
                </span>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    color: theme.text_primary || "var(--foreground)",
                  }}
                >
                  Notifications
                </span>
              </div>

              {/* Mock trip content */}
              <div className="relative space-y-4 p-5">
                <div>
                  <h3
                    className="text-2xl font-black uppercase tracking-tight"
                    style={{
                      fontFamily: font
                        ? `"${font}", sans-serif`
                        : undefined,
                      color: theme.text_primary || "var(--foreground)",
                    }}
                  >
                    {tripName}
                  </h3>
                  <p
                    className="mt-0.5 text-sm"
                    style={{
                      fontFamily: font
                        ? `"${font}", sans-serif`
                        : undefined,
                      color: theme.text_secondary || "var(--muted-foreground)",
                    }}
                  >
                    Mar 15 &ndash; Mar 22 &middot; Sample Destination
                  </p>
                </div>

                {/* Mock itinerary items */}
                <div className="space-y-2">
                  {[
                    {
                      time: "9:00 AM",
                      title: "Breakfast at Local Caf\u00e9",
                      location: "Downtown Square",
                    },
                    {
                      time: "2:00 PM",
                      title: "City Walking Tour",
                      location: "Meeting Point Plaza",
                    },
                  ].map((item) => (
                    <div
                      key={item.time}
                      className="flex items-center gap-3 border-2 p-3 backdrop-blur-sm"
                      style={{
                        borderColor: theme.border_color
                          ? theme.border_color + "40"
                          : "var(--border)",
                        backgroundColor: theme.surface_color
                          ? theme.surface_color + "cc"
                          : "rgba(var(--surface), 0.8)",
                      }}
                    >
                      <span
                        className="whitespace-nowrap text-xs font-bold"
                        style={{
                          color:
                            theme.text_secondary ||
                            "var(--muted-foreground)",
                        }}
                      >
                        {item.time}
                      </span>
                      <div>
                        <p
                          className="text-sm font-semibold"
                          style={{
                            fontFamily: font
                              ? `"${font}", sans-serif`
                              : undefined,
                            color:
                              theme.surface_foreground ||
                              theme.text_primary ||
                              "var(--foreground)",
                          }}
                        >
                          {item.title}
                        </p>
                        <p
                          className="text-xs"
                          style={{
                            color:
                              theme.text_secondary ||
                              "var(--muted-foreground)",
                          }}
                        >
                          {item.location}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mock button */}
                <button
                  type="button"
                  className="border-2 px-4 py-2 text-xs font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: accentColor,
                    color: btnTextColor,
                    borderColor: theme.border_color
                      ? theme.border_color + "60"
                      : "var(--border)",
                    boxShadow: `3px 3px 0px 0px ${
                      theme.border_color
                        ? theme.border_color + "40"
                        : "var(--border)"
                    }`,
                  }}
                >
                  RSVP Going
                </button>
              </div>
            </div>
          </section>

          {/* ── Error ───────────────────────────────────────── */}
          {errorMessage && (
            <div className="border-2 border-[#ef4444]/40 bg-[#450a0a]/90 px-4 py-3 text-sm text-[#fca5a5]">
              {errorMessage}
            </div>
          )}

          {/* ── Actions ─────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={isSaving}
              isLoading={isSaving}
              size="lg"
              onClick={() => void handleSave()}
            >
              {isSaving ? "Saving..." : "Save theme"}
            </Button>
            <Button variant="secondary" size="lg" onClick={handleReset}>
              Reset to default
            </Button>
            <Link href={`/trip/${tripId}`}>
              <Button variant="ghost" size="lg">
                Cancel
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </TripThemeProvider>
  );
}
