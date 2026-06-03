import React, { useState, useMemo, useEffect } from 'react';
import { 
  Trophy, Users, Activity, CheckCircle, AlertTriangle, 
  ChevronRight, Calculator, Star, Shield, User, 
  Search, Plus, Minus, RefreshCw, Award, ShieldAlert, CheckCircle2, Lock, Unlock, LogOut, Key, Trash2, UserPlus, Calendar, CloudLightning,
  Download, Upload, Save, Eye, EyeOff
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// Safely initialize Firebase with fallback for testing
const hasFirebase = typeof __firebase_config !== 'undefined' && __firebase_config;
let db = null;
let auth = null;
let appId = 'default-app-id';

if (hasFirebase) {
  try {
    const firebaseConfig = JSON.parse(__firebase_config);
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  } catch (e) {
    console.error("Firebase init failed:", e);
  }
}

const OFFICIAL_TEAMS = {
  A: ['España', 'Francia', 'Argentina', 'Brasil', 'Alemania', 'Portugal', 'Inglaterra'],
  B: ['Mexico', 'Suiza', 'Paises Bajos', 'Belgica', 'Marruecos', 'Senegal', 'Uruguay', 'Noruega', 'Colombia', 'Turquia', 'Croacia', 'Ecuador'],
  C: ['EEUU', 'Canada', 'Austria', 'Suecia', 'Japon', 'Rep. Checa'],
  D: ['Paraguay', 'Escocia', 'Bosnia', 'Egypto', 'Costa Marfil', 'Argelia', 'Ghana', 'Tunez', 'Iran', 'Corea del Sur'],
  E: ['Congo', 'Australia', 'Sudafrica', 'Arabia Saudita', 'Qatar', 'Irak', 'Nueva Zelanda', 'Panama', 'Cabo Verde', 'Uzbekistan', 'Curasao', 'Jordania', 'Hiati']
};

const TEAMS_LIMITS = { A: 3, B: 4, C: 2, D: 3, E: 2 };

const OFFICIAL_PLAYERS = {
  G1: ['Mbappe', 'H. Kane', 'L. Yamal', 'Vinicius'],
  G2: ['Messi', 'C. Ronaldo', 'Halland', 'J.Alvarez', 'Raphinha', 'Bellingham', 'Dembele', 'Luis Diaz', 'Oyarzabal', 'Havertz'],
  G3: ['Sorloth', 'Neymar', 'Isak', 'Mane', 'Pedri', 'Salah', 'F. Torres', 'Gyokeres', 'Lukaku', 'Musiala', 'Darwin Nuñez', 'F. Wirtz', 'Modric', 'A Guler', 'Brahim Diaz', 'Olise', 'Vitinha']
};

const PLAYERS_LIMITS = { G1: 1, G2: 2, G3: 3 };

const EXTRA_POINTS = {
  'A': { p16: 1, p8: 2, p4: 4, p2: 8, p1: 10 },
  'B': { p16: 2, p8: 4, p4: 8, p2: 12, p1: 16 },
  'C': { p16: 4, p8: 8, p4: 12, p2: 20, p1: 30 },
  'D': { p16: 6, p8: 12, p4: 24, p2: 32, p1: 60 },
  'E': { p16: 10, p8: 20, p4: 30, p2: 60, p1: 100 }
};

const JORNADAS = ['J1', 'J2', 'J3', '1/16', '1/8', '1/4', 'Fase Final'];

const initialTeamStats = {
  W: 0, D: 0, GF: 0, GA: 0,
  WReg: 0, WET: 0, DLoss: 0
};

const initialPlayerStats = {
  G: 0, MVP: 0, Y: 0, DY: 0, R: 0
};

const generateDefaultParticipants = () => {
  const names = ["Basti", "Txitxi", "Garci", "Llaku", "Ortzi", "Milikua", "Txarlie", "Jon Bast"];
  return names.map((name, i) => ({
    id: i + 1,
    name: name,
    pin: "0000",
    isLocked: false,
    selectedTeams: { A: [], B: [], C: [], D: [], E: [] },
    selectedPlayers: { G1: [], G2: [], G3: [], Otro: [] }
  }));
};

export default function App() {
  const [activeTab, setActiveTab] = useState('ranking');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [activeJornada, setActiveJornada] = useState('General');
  const [adminActiveJornada, setAdminActiveJornada] = useState('J1');
  
  // Custom dialog confirmations state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  // Modal to spy on locked roster selections
  const [spiedParticipant, setSpiedParticipant] = useState(null);

  // Security elements
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminError, setAdminError] = useState('');

  // Local state replicas synced with Firebase
  const [participants, setParticipants] = useState(() => generateDefaultParticipants());
  const [masterTeamStats, setMasterTeamStats] = useState({});
  const [masterPlayerStats, setMasterPlayerStats] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);

  // Selections & filters
  const [selectedParticipantId, setSelectedParticipantId] = useState(1);
  const [loggedInParticipantId, setLoggedInParticipantId] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [newPinValue, setNewPinValue] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);

  // Participant Management (Admin role)
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantPin, setNewParticipantPin] = useState('0000');
  const [editingParticipantId, setEditingParticipantId] = useState(null);
  const [editingParticipantName, setEditingParticipantName] = useState('');
  const [editingParticipantPin, setEditingParticipantPin] = useState('');

  const [adminSelectedParticipantId, setAdminSelectedParticipantId] = useState(1);
  const [teamSearch, setTeamSearch] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const [customPlayerText, setCustomPlayerText] = useState('');

  // 1. One-time authentication flow
  useEffect(() => {
    if (!hasFirebase) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFirebaseUser);
    return () => unsubscribe();
  }, []);

  // 2. Continuous real-time synchronization of state documents
  useEffect(() => {
    if (!hasFirebase || !firebaseUser) return;
    setIsSyncing(true);

    const unsubParticipants = onSnapshot(
      doc(db, 'artifacts', appId, 'public', 'data', 'state', 'participants'),
      (snapshot) => {
        if (snapshot.exists()) {
          setParticipants(snapshot.data().list || []);
        } else {
          // Push initial layout to DB
          setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'state', 'participants'), { list: generateDefaultParticipants() });
        }
      },
      (error) => console.error("Error loading participants:", error)
    );

    const unsubTeams = onSnapshot(
      doc(db, 'artifacts', appId, 'public', 'data', 'state', 'teamStats'),
      (snapshot) => {
        if (snapshot.exists()) {
          setMasterTeamStats(snapshot.data().stats || {});
        }
      },
      (error) => console.error("Error loading team stats:", error)
    );

    const unsubPlayers = onSnapshot(
      doc(db, 'artifacts', appId, 'public', 'data', 'state', 'playerStats'),
      (snapshot) => {
        if (snapshot.exists()) {
          setMasterPlayerStats(snapshot.data().stats || {});
        }
        setIsSyncing(false);
      },
      (error) => {
        console.error("Error loading player stats:", error);
        setIsSyncing(false);
      }
    );

    return () => {
      unsubParticipants();
      unsubTeams();
      unsubPlayers();
    };
  }, [firebaseUser]);

  const saveParticipants = async (updatedList) => {
    setParticipants(updatedList);
    if (hasFirebase && firebaseUser) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'state', 'participants'), { list: updatedList });
      } catch (e) {
        console.error("Failed saving participants to cloud:", e);
      }
    }
  };

  const saveTeamStats = async (updatedStats) => {
    setMasterTeamStats(updatedStats);
    if (hasFirebase && firebaseUser) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'state', 'teamStats'), { stats: updatedStats });
      } catch (e) {
        console.error("Failed saving team stats to cloud:", e);
      }
    }
  };

  const savePlayerStats = async (updatedStats) => {
    setMasterPlayerStats(updatedStats);
    if (hasFirebase && firebaseUser) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'state', 'playerStats'), { stats: updatedStats });
      } catch (e) {
        console.error("Failed saving player stats to cloud:", e);
      }
    }
  };

  const activeSelectedTeams = useMemo(() => {
    const teams = new Set();
    participants.forEach(p => {
      Object.values(p.selectedTeams).forEach(groupList => {
        groupList.forEach(t => teams.add(t));
      });
    });
    return teams;
  }, [participants]);

  const activeSelectedPlayers = useMemo(() => {
    const players = new Set();
    participants.forEach(p => {
      Object.values(p.selectedPlayers).forEach(groupList => {
        groupList.forEach(pl => players.add(pl));
      });
    });
    return players;
  }, [participants]);

  const activeParticipant = useMemo(() => {
    return participants.find(p => p.id === loggedInParticipantId) || null;
  }, [participants, loggedInParticipantId]);

  const adminTargetParticipant = useMemo(() => {
    return participants.find(p => p.id === adminSelectedParticipantId) || participants[0];
  }, [participants, adminSelectedParticipantId]);

  const filteredTeamsList = useMemo(() => {
    const list = [];
    Object.keys(OFFICIAL_TEAMS).forEach(group => {
      OFFICIAL_TEAMS[group].forEach(team => {
        if (activeSelectedTeams.has(team)) {
          if (team.toLowerCase().includes(teamSearch.toLowerCase())) {
            list.push({ team, group });
          }
        }
      });
    });
    return list;
  }, [teamSearch, activeSelectedTeams]);

  const filteredPlayersList = useMemo(() => {
    const list = [];
    // 1. Official players chosen by someone
    Object.keys(OFFICIAL_PLAYERS).forEach(group => {
      OFFICIAL_PLAYERS[group].forEach(player => {
        if (activeSelectedPlayers.has(player)) {
          if (player.toLowerCase().includes(playerSearch.toLowerCase())) {
            list.push({ player, group });
          }
        }
      });
    });

    // 2. Custom ("Otro") players chosen by someone directly in activeSelectedPlayers
    const officialNames = Object.values(OFFICIAL_PLAYERS).flat();
    activeSelectedPlayers.forEach(player => {
      if (!officialNames.includes(player)) {
        if (player.toLowerCase().includes(playerSearch.toLowerCase())) {
          list.push({ player, group: 'Otro' });
        }
      }
    });

    return list;
  }, [playerSearch, activeSelectedPlayers]);

  const getTeamPointsForJornada = (teamName, group, jornada) => {
    const teamData = masterTeamStats[teamName];
    if (!teamData || !teamData[jornada]) return 0;
    const stats = teamData[jornada];
    let points = 0;

    if (['J1', 'J2', 'J3'].includes(jornada)) {
      points += (stats.W || 0) * 3;
      points += (stats.D || 0) * 1;
      points += (stats.GF || 0) * 1;
      points -= (stats.GA || 0) * 1;
    } else {
      points += (stats.WReg || 0) * 5;
      points += (stats.WET || 0) * 3;
      points += (stats.DLoss || 0) * 1;
      points += (stats.GF || 0) * 1;
      points -= (stats.GA || 0) * 1;
    }
    return points;
  };

  const getPlayerPointsForJornada = (playerName, jornada) => {
    const playerData = masterPlayerStats[playerName];
    if (!playerData || !playerData[jornada]) return 0;
    const stats = playerData[jornada];
    let points = 0;

    points += (stats.G || 0) * 1;
    points += (stats.MVP || 0) * 2;
    points -= (stats.Y || 0) * 1;
    points -= (stats.DY || 0) * 2;
    points -= (stats.R || 0) * 3;
    return points;
  };

  const getParticipantScore = (participant, selectedJor = 'General') => {
    let teamPts = 0;
    let playerPts = 0;

    if (selectedJor === 'General') {
      JORNADAS.forEach(jor => {
        Object.keys(participant.selectedTeams).forEach(group => {
          participant.selectedTeams[group].forEach(team => {
            teamPts += getTeamPointsForJornada(team, group, jor);
          });
        });

        Object.keys(participant.selectedPlayers).forEach(group => {
          participant.selectedPlayers[group].forEach(player => {
            playerPts += getPlayerPointsForJornada(player, jor);
          });
        });
      });

      Object.keys(participant.selectedTeams).forEach(group => {
        participant.selectedTeams[group].forEach(team => {
          const teamData = masterTeamStats[team];
          if (teamData && teamData.global) {
            const stats = teamData.global;
            const rates = EXTRA_POINTS[group] || { p16: 0, p8: 0, p4: 0, p2: 0, p1: 0 };
            if (stats.p16) teamPts += rates.p16;
            if (stats.p8) teamPts += rates.p8;
            if (stats.p4) teamPts += rates.p4;
            if (stats.p2) teamPts += rates.p2;
            if (stats.p1) teamPts += rates.p1;
          }
        });
      });

      Object.keys(participant.selectedPlayers).forEach(group => {
        participant.selectedPlayers[group].forEach(player => {
          const playerData = masterPlayerStats[player];
          if (playerData && playerData.global) {
            const stats = playerData.global;
            if (stats.bota) playerPts += 10;
            if (stats.balon) playerPts += 20;
          }
        });
      });

    } else {
      Object.keys(participant.selectedTeams).forEach(group => {
        participant.selectedTeams[group].forEach(team => {
          teamPts += getTeamPointsForJornada(team, group, selectedJor);
        });
      });

      Object.keys(participant.selectedPlayers).forEach(group => {
        participant.selectedPlayers[group].forEach(player => {
          playerPts += getPlayerPointsForJornada(player, selectedJor);
        });
      });
    }

    return {
      teamsScore: teamPts,
      playersScore: playerPts,
      totalScore: teamPts + playerPts
    };
  };

  const leaderboard = useMemo(() => {
    return participants.map(p => {
      const scores = getParticipantScore(p, activeJornada);
      const totalTeamsCount = Object.values(p.selectedTeams).flat().length;
      const totalPlayersCount = Object.values(p.selectedPlayers).flat().length;
      return {
        ...p,
        ...scores,
        isComplete: totalTeamsCount === 14 && totalPlayersCount === 5,
        totalTeamsCount,
        totalPlayersCount
      };
    }).sort((a, b) => b.totalScore - a.totalScore);
  }, [participants, masterTeamStats, masterPlayerStats, activeJornada]);

  const triggerConfirm = (title, message, action) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        if (action) action();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Auth & Session actions
  const handleAdminLogin = () => {
    if (adminPasswordInput === '1978') {
      setIsAdminMode(true);
      setShowAdminModal(false);
      setAdminError('');
      setAdminPasswordInput('');
      setActiveTab('admin_edit_roster');
    } else {
      setAdminError('Clave de administrador incorrecta. Inténtelo de nuevo.');
    }
  };

  const handleParticipantLogin = () => {
    const part = participants.find(p => p.id === selectedParticipantId);
    if (!part) return;
    
    if (pinInput === part.pin) {
      setLoggedInParticipantId(selectedParticipantId);
      setPinError('');
      setPinInput('');
      setNewPinValue('');
      setPinChangeSuccess(false);
    } else {
      setPinError('El PIN introducido es incorrecto para este participante.');
    }
  };

  const handleUpdatePin = () => {
    if (newPinValue.length !== 4 || isNaN(newPinValue)) {
      setPinError('El nuevo PIN debe ser de exactamente 4 dígitos numéricos.');
      return;
    }
    const updated = participants.map(p => {
      if (p.id === loggedInParticipantId) {
        return { ...p, pin: newPinValue };
      }
      return p;
    });
    saveParticipants(updated);
    setNewPinValue('');
    setPinChangeSuccess(true);
    setPinError('');
  };

  const handleLogoutParticipant = () => {
    setLoggedInParticipantId(null);
    setPinInput('');
    setPinError('');
  };

  const toggleTeamSelection = (targetId, group, teamName, forceAdmin = false) => {
    const target = participants.find(p => p.id === targetId);
    if (!target) return;
    if (target.isLocked && !forceAdmin) return;

    const updated = participants.map(p => {
      if (p.id === targetId) {
        const currentList = p.selectedTeams[group] || [];
        if (currentList.includes(teamName)) {
          return {
            ...p,
            selectedTeams: {
              ...p.selectedTeams,
              [group]: currentList.filter(t => t !== teamName)
            }
          };
        } else {
          if (currentList.length < TEAMS_LIMITS[group]) {
            return {
              ...p,
              selectedTeams: {
                ...p.selectedTeams,
                [group]: [...currentList, teamName]
              }
            };
          }
        }
      }
      return p;
    });
    saveParticipants(updated);
  };

  const togglePlayerSelection = (targetId, group, playerName, forceAdmin = false) => {
    const target = participants.find(p => p.id === targetId);
    if (!target) return;
    if (target.isLocked && !forceAdmin) return;

    const updated = participants.map(p => {
      if (p.id === targetId) {
        const currentList = p.selectedPlayers[group] || [];
        const totalSelectedPlayers = Object.values(p.selectedPlayers).flat().length;

        if (currentList.includes(playerName)) {
          return {
            ...p,
            selectedPlayers: {
              ...p.selectedPlayers,
              [group]: currentList.filter(pl => pl !== playerName)
            }
          };
        } else {
          if (totalSelectedPlayers >= 5) return p;

          if (group !== 'Otro') {
            if (currentList.length < PLAYERS_LIMITS[group]) {
              return {
                ...p,
                selectedPlayers: {
                  ...p.selectedPlayers,
                  [group]: [...currentList, playerName]
                }
              };
            }
          }
        }
      }
      return p;
    });
    saveParticipants(updated);
  };

  const handleLockRoster = (targetId) => {
    const updated = participants.map(p => {
      if (p.id === targetId) {
        return { ...p, isLocked: true };
      }
      return p;
    });
    saveParticipants(updated);
  };

  const handleUnlockRosterByAdmin = (targetId) => {
    const updated = participants.map(p => {
      if (p.id === targetId) {
        return { ...p, isLocked: false };
      }
      return p;
    });
    saveParticipants(updated);
  };

  const addCustomPlayer = (targetId, forceAdmin = false) => {
    if (!customPlayerText.trim()) return;
    const name = customPlayerText.trim();
    const target = participants.find(p => p.id === targetId);
    if (!target || (target.isLocked && !forceAdmin)) return;

    const isOfficial = Object.values(OFFICIAL_PLAYERS).flat().includes(name);
    if (isOfficial) {
      setCustomPlayerText('');
      return; 
    }

    const updated = participants.map(p => {
      if (p.id === targetId) {
        const currentOthers = p.selectedPlayers.Otro || [];
        const totalSelectedPlayers = Object.values(p.selectedPlayers).flat().length;

        if (totalSelectedPlayers < 5 && !currentOthers.includes(name)) {
          return {
            ...p,
            selectedPlayers: {
              ...p.selectedPlayers,
              Otro: [...currentOthers, name]
            }
          };
        }
      }
      return p;
    });
    saveParticipants(updated);
    setCustomPlayerText('');
  };

  const removeCustomPlayer = (targetId, name, forceAdmin = false) => {
    const target = participants.find(p => p.id === targetId);
    if (!target || (target.isLocked && !forceAdmin)) return;

    const updated = participants.map(p => {
      if (p.id === targetId) {
        return {
          ...p,
          selectedPlayers: {
            ...p.selectedPlayers,
            Otro: (p.selectedPlayers.Otro || []).filter(item => item !== name)
          }
        };
      }
      return p;
    });
    saveParticipants(updated);
  };

  const handleAddParticipant = () => {
    if (!newParticipantName.trim()) return;
    const nextId = participants.length > 0 ? Math.max(...participants.map(p => p.id)) + 1 : 1;
    const newPart = {
      id: nextId,
      name: newParticipantName.trim(),
      pin: newParticipantPin.length === 4 && !isNaN(newParticipantPin) ? newParticipantPin : "0000",
      isLocked: false,
      selectedTeams: { A: [], B: [], C: [], D: [], E: [] },
      selectedPlayers: { G1: [], G2: [], G3: [], Otro: [] }
    };
    saveParticipants([...participants, newPart]);
    setNewParticipantName('');
    setNewParticipantPin('0000');
  };

  const handleStartEditParticipant = (part) => {
    setEditingParticipantId(part.id);
    setEditingParticipantName(part.name);
    setEditingParticipantPin(part.pin);
  };

  const handleSaveParticipantEdit = () => {
    if (!editingParticipantName.trim()) return;
    const updated = participants.map(p => {
      if (p.id === editingParticipantId) {
        return { 
          ...p, 
          name: editingParticipantName.trim(),
          pin: editingParticipantPin.length === 4 && !isNaN(editingParticipantPin) ? editingParticipantPin : p.pin
        };
      }
      return p;
    });
    saveParticipants(updated);
    setEditingParticipantId(null);
  };

  const handleDeleteParticipant = (id) => {
    const filtered = participants.filter(p => p.id !== id);
    saveParticipants(filtered);
    if (adminSelectedParticipantId === id && filtered.length > 0) {
      setAdminSelectedParticipantId(filtered[0].id);
    }
  };

  const handleUpdateTeamStat = (teamName, statField, increment, isGlobalBonus = false) => {
    const currentTeamData = masterTeamStats[teamName] || { global: { p16: false, p8: false, p4: false, p2: false, p1: false } };
    let updated;

    if (isGlobalBonus) {
      const currentGlobal = currentTeamData.global || { p16: false, p8: false, p4: false, p2: false, p1: false };
      updated = {
        ...masterTeamStats,
        [teamName]: {
          ...currentTeamData,
          global: {
            ...currentGlobal,
            [statField]: !currentGlobal[statField]
          }
        }
      };
    } else {
      const currentJorData = currentTeamData[adminActiveJornada] || { ...initialTeamStats };
      const updatedVal = Math.max(0, (currentJorData[statField] || 0) + increment);
      updated = {
        ...masterTeamStats,
        [teamName]: {
          ...currentTeamData,
          [adminActiveJornada]: {
            ...currentJorData,
            [statField]: updatedVal
          }
        }
      };
    }
    saveTeamStats(updated);
  };

  const handleUpdatePlayerStat = (playerName, statField, increment, isGlobalBonus = false) => {
    const currentPlayerData = masterPlayerStats[playerName] || { global: { bota: false, balon: false } };
    let updated;

    if (isGlobalBonus) {
      const currentGlobal = currentPlayerData.global || { bota: false, balon: false };
      updated = {
        ...masterPlayerStats,
        [playerName]: {
          ...currentPlayerData,
          global: {
            ...currentGlobal,
            [statField]: !currentGlobal[statField]
          }
        }
      };
    } else {
      const currentJorData = currentPlayerData[adminActiveJornada] || { ...initialPlayerStats };
      const updatedVal = Math.max(0, (currentJorData[statField] || 0) + increment);
      updated = {
        ...masterPlayerStats,
        [playerName]: {
          ...currentPlayerData,
          [adminActiveJornada]: {
            ...currentJorData,
            [statField]: updatedVal
          }
        }
      };
    }
    savePlayerStats(updated);
  };

  const handleResetTournamentData = () => {
    const cleanedParticipants = participants.map(p => ({
      ...p,
      isLocked: false,
      selectedTeams: { A: [], B: [], C: [], D: [], E: [] },
      selectedPlayers: { G1: [], G2: [], G3: [], Otro: [] }
    }));
    saveParticipants(cleanedParticipants);
    saveTeamStats({});
    savePlayerStats({});
  };

  // --- EXPORT ROSTER SELECTION ---
  const handleExportRoster = () => {
    if (!activeParticipant) return;
    const fileData = {
      selectedTeams: activeParticipant.selectedTeams,
      selectedPlayers: activeParticipant.selectedPlayers
    };
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(fileData, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", `porra_2026_seleccion_${activeParticipant.name}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // --- IMPORT ROSTER SELECTION ---
  const handleImportRoster = (e) => {
    const fileReader = new FileReader();
    if (!e.target.files || e.target.files.length === 0) return;
    
    fileReader.readAsText(e.target.files[0], "UTF-8");
    fileReader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (importedData.selectedTeams && importedData.selectedPlayers) {
          const updated = participants.map(p => {
            if (p.id === loggedInParticipantId) {
              return {
                ...p,
                selectedTeams: importedData.selectedTeams,
                selectedPlayers: importedData.selectedPlayers
              };
            }
            return p;
          });
          saveParticipants(updated);
          triggerConfirm(
            "Selección Importada", 
            "Tu selección de equipos y jugadores se ha cargado correctamente desde el archivo. Recuerda hacer clic en 'Guardar Plantilla en la Nube' para sincronizar.", 
            () => {}
          );
        } else {
          triggerConfirm("Error de Formato", "El archivo JSON no tiene el formato de selección correcto.", () => {});
        }
      } catch (err) {
        triggerConfirm("Error al Leer Archivo", "No se ha podido procesar el archivo seleccionado.", () => {});
      }
    };
  };

  // --- ADMIN EXPORT SCOREBOARD STATS ---
  const handleExportAllStats = () => {
    const fileData = {
      masterTeamStats,
      masterPlayerStats,
      exportedAt: new Date().toISOString()
    };
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(fileData, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", `porra_2026_stats_oficiales_jornadas.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // --- ADMIN IMPORT SCOREBOARD STATS ---
  const handleImportAllStats = (e) => {
    const fileReader = new FileReader();
    if (!e.target.files || e.target.files.length === 0) return;
    fileReader.readAsText(e.target.files[0], "UTF-8");
    fileReader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (importedData.masterTeamStats && importedData.masterPlayerStats) {
          saveTeamStats(importedData.masterTeamStats);
          savePlayerStats(importedData.masterPlayerStats);
          triggerConfirm(
            "Estadísticas Importadas", 
            "Todas las puntuaciones y estadísticas de las jornadas se han cargado correctamente del archivo oficial.", 
            () => {}
          );
        } else {
          triggerConfirm("Error de Formato", "El archivo JSON no tiene el formato de estadísticas oficial de la Porra.", () => {});
        }
      } catch (err) {
        triggerConfirm("Error al Leer Archivo", "No se ha podido procesar el archivo seleccionado.", () => {});
      }
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-16">
      
      {/* Dynamic Global Header */}
      <header className="bg-[#5d1a33] text-white shadow-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="bg-yellow-500 p-2.5 rounded-lg text-slate-900 shadow-md">
              <Trophy size={26} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight">PORRA MUNDIAL'2026</h1>
                {hasFirebase && (
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${isSyncing ? 'bg-amber-500/35 text-amber-100 animate-pulse' : 'bg-emerald-500/25 text-emerald-200'}`}>
                    <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                    {isSyncing ? 'Sincronizando' : 'Nube Conectada'}
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-200 uppercase tracking-widest font-semibold">GRUPO DE AMIGOS - ESTADÍSTICAS OFICIALES</p>
            </div>
          </div>

          {/* User access interface */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="text-xs font-semibold uppercase text-rose-100">Rol Actual:</span>
            <div className="bg-[#411022] p-1.5 rounded-xl border border-rose-900/40 flex items-center gap-1">
              <button 
                onClick={() => { 
                  setIsAdminMode(false); 
                  setActiveTab('ranking'); 
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${!isAdminMode ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow' : 'text-rose-200 hover:text-white'}`}
              >
                <User size={14} /> Participante
              </button>
              
              {!isAdminMode ? (
                <button 
                  onClick={() => setShowAdminModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all text-rose-200 hover:text-white hover:bg-white/5"
                >
                  <Shield size={14} /> Administrador
                </button>
              ) : (
                <button 
                  onClick={() => {
                    setIsAdminMode(false);
                    setActiveTab('ranking');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow"
                >
                  <Shield size={14} /> Admin Activo (Salir)
                </button>
              )}
            </div>
          </div>

        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        
        {/* Navigation tabs */}
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-6 overflow-x-auto">
          {!isAdminMode ? (
            <>
              <button
                onClick={() => setActiveTab('ranking')}
                className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-black transition-all ${activeTab === 'ranking' ? 'bg-[#5d1a33] text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
              >
                <Trophy size={16} /> Clasificación General
              </button>
              <button
                onClick={() => setActiveTab('form')}
                className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-black transition-all ${activeTab === 'form' ? 'bg-[#5d1a33] text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
              >
                <Users size={16} /> Mi Formulario Roster
              </button>
            </>
          ) : (
            <>
              <div className="bg-amber-100 text-amber-900 px-3 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 mr-2">
                <Shield size={15} /> MODO ADMIN
              </div>
              <button
                onClick={() => setActiveTab('ranking')}
                className={`flex-1 min-w-[110px] flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-black transition-all ${activeTab === 'ranking' ? 'bg-amber-600 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
              >
                <Trophy size={14} /> Clasificación
              </button>
              <button
                onClick={() => setActiveTab('admin_edit_roster')}
                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-black transition-all ${activeTab === 'admin_edit_roster' ? 'bg-amber-600 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
              >
                <Users size={14} /> Gestionar Plantillas
              </button>
              <button
                onClick={() => setActiveTab('admin_participants_list')}
                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-black transition-all ${activeTab === 'admin_participants_list' ? 'bg-amber-600 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
              >
                <UserPlus size={14} /> Participantes ({participants.length})
              </button>
              <button
                onClick={() => setActiveTab('admin_teams')}
                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-black transition-all ${activeTab === 'admin_teams' ? 'bg-amber-600 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
              >
                <Activity size={14} /> Stats Equipos
              </button>
              <button
                onClick={() => setActiveTab('admin_players')}
                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-black transition-all ${activeTab === 'admin_players' ? 'bg-amber-600 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
              >
                <Star size={14} /> Stats Jugadores
              </button>
            </>
          )}
        </div>

        {/* ======================= TAB 1: CLASIFICACIÓN GENERAL & JORNADAS ======================= */}
        {activeTab === 'ranking' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-[#3a1020] text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Trophy size={200} />
              </div>
              <h2 className="text-xl font-black mb-1 flex items-center gap-2">
                <Award className="text-yellow-400" /> CLASIFICACIÓN DEL GRUPO
              </h2>
              <p className="text-sm text-slate-300 max-w-2xl">
                Clasificación de la Porra Mundial'2026. Haz clic sobre un participante con la plantilla **bloqueada** (🔒) para cotillear y auditar su alineación y puntuaciones individuales.
              </p>

              {/* Matchday Selector */}
              <div className="mt-5 border-t border-slate-700/60 pt-4">
                <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider block mb-2">Filtrar clasificación por etapa:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setActiveJornada('General')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${activeJornada === 'General' ? 'bg-yellow-500 text-slate-950 font-black scale-105' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                  >
                    Acumulado General
                  </button>
                  {JORNADAS.map(jor => (
                    <button
                      key={jor}
                      onClick={() => setActiveJornada(jor)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${activeJornada === jor ? 'bg-rose-600 text-white font-black scale-105' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {jor === 'Fase Final' ? 'Fase Final (Semis + Final)' : `Jornada ${jor}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Leaderboard Table */}
            <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
                  <Calendar size={18} className="text-rose-600" />
                  Puntuación de {activeJornada === 'General' ? 'Todo el Torneo (General)' : `la Jornada: ${activeJornada}`}
                </h3>
                <span className="text-xs font-semibold text-slate-500">
                  {activeJornada === 'General' ? '*Incluye puntos extra de pases de ronda y premios de fin de torneo' : '*Solo incluye estadísticas directas de los partidos de la jornada seleccionada'}
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-xs uppercase font-extrabold border-b border-slate-200">
                      <th className="py-3 px-4 text-center w-16">Puesto</th>
                      <th className="py-3 px-4">Participante</th>
                      <th className="py-3 px-4 text-center">Estado Plantilla</th>
                      <th className="py-3 px-4 text-center">Visualizar Roster</th>
                      <th className="py-3 px-4 text-right">Ptos Equipos</th>
                      <th className="py-3 px-4 text-right">Ptos Jugadores</th>
                      <th className="py-3 px-4 text-right bg-slate-50 font-black text-[#5d1a33] w-32">Total Puntos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((p, index) => {
                      const rank = index + 1;
                      let medalColor = "";
                      if (rank === 1) medalColor = "bg-yellow-400 text-slate-900";
                      else if (rank === 2) medalColor = "bg-slate-300 text-slate-900";
                      else if (rank === 3) medalColor = "bg-amber-600 text-white";
                      else medalColor = "bg-slate-200 text-slate-700";

                      return (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-4 text-center">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-black text-xs ${medalColor}`}>
                              {rank}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div>
                              <span className="font-black text-slate-950 text-base">{p.name}</span>
                              <div className="text-xs text-slate-500 mt-1">
                                ID: #{p.id}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${p.isComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {p.isComplete ? <CheckCircle2 size={13} /> : <ShieldAlert size={13} />}
                              {p.totalTeamsCount}/14 Eq. | {p.totalPlayersCount}/5 Jug.
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {p.isLocked ? (
                              <button
                                onClick={() => setSpiedParticipant(p)}
                                className="inline-flex items-center gap-1.5 text-xs font-black bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg transition-all"
                              >
                                <Eye size={13} /> Ver Selección 🔒
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg text-xs font-bold border border-emerald-100">
                                <EyeOff size={13} className="text-emerald-500" /> Abierta (Privada)
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right font-bold text-rose-700">
                            {p.teamsScore}
                          </td>
                          <td className="py-4 px-4 text-right font-bold text-indigo-700">
                            {p.playersScore}
                          </td>
                          <td className="py-4 px-4 text-right bg-slate-50 font-black text-xl text-[#5d1a33]">
                            {p.totalScore} pts
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Help instructions bar */}
            <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">¿Cómo rellenar mi plantilla de forma privada?</span>
                <span>Ve a la pestaña "Mi Formulario Roster", introduce tu PIN de seguridad (0000 por defecto) y monta tu equipo tranquilamente.</span>
              </div>
              <button 
                onClick={() => setActiveTab('form')}
                className="bg-[#5d1a33] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#461124] flex-shrink-0"
              >
                Acceder a Mi Formulario
              </button>
            </div>

          </div>
        )}

        {/* ======================= TAB 2: PRIVATED INDEPENDENT ROSTER FORM ======================= */}
        {activeTab === 'form' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {loggedInParticipantId === null ? (
              <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-6">
                <div className="text-center space-y-2">
                  <div className="bg-rose-50 p-3 rounded-full text-[#5d1a33] inline-block mx-auto">
                    <Key size={32} />
                  </div>
                  <h2 className="text-xl font-black text-slate-900 uppercase">Acceso Roster Privado</h2>
                  <p className="text-xs text-slate-500">
                    Introduce tus credenciales para rellenar de forma independiente tu plantilla del torneo. Tu selección no podrá ser visualizada por otros participantes hasta que sea bloqueada oficialmente.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-slate-500 block">Selecciona Tu Nombre</label>
                    <select
                      value={selectedParticipantId}
                      onChange={(e) => {
                        setSelectedParticipantId(parseInt(e.target.value));
                        setPinError('');
                      }}
                      className="w-full p-3 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 bg-slate-50 focus:ring-2 focus:ring-[#5d1a33] focus:outline-none"
                    >
                      {participants.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-slate-500 block">Tu PIN de 4 dígitos</label>
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="0000"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleParticipantLogin();
                      }}
                      className="w-full p-3 border border-slate-300 rounded-xl text-center text-lg font-black tracking-widest bg-slate-50 focus:ring-2 focus:ring-[#5d1a33] focus:outline-none"
                    />
                    <span className="text-[11px] text-slate-400 block mt-1 text-center">PIN inicial por defecto: 0000</span>
                  </div>

                  {pinError && (
                    <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg flex items-center gap-2 border border-red-200 font-semibold">
                      <AlertTriangle size={16} className="flex-shrink-0" />
                      <span>{pinError}</span>
                    </div>
                  )}

                  <button
                    onClick={handleParticipantLogin}
                    className="w-full bg-[#5d1a33] text-white p-3.5 rounded-xl text-sm font-black uppercase tracking-wider hover:bg-[#461124] transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    Ingresar de Forma Segura <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ) : (
              /* Participant is Logged In - Independent Session View */
              <div className="space-y-6">
                
                <div className="bg-white rounded-xl shadow p-6 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1 flex-1">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Sesión Activa</span>
                    <h2 className="text-2xl font-black text-slate-900">{activeParticipant.name}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>ID: #{activeParticipant.id}</span>
                      <span>•</span>
                      {activeParticipant.isLocked ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <Lock size={12} /> Cerrada y Bloqueada por Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <Unlock size={12} /> Abierta para Edición
                        </span>
                      )}
                    </div>

                    {/* IMPORT / EXPORT TOOLS */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                      <button
                        onClick={handleExportRoster}
                        className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 shadow"
                      >
                        <Download size={14} /> Exportar Selección (.json)
                      </button>
                      
                      {!activeParticipant.isLocked && (
                        <label className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 border border-slate-300 shadow cursor-pointer">
                          <Upload size={14} /> Importar Selección (.json)
                          <input 
                            type="file" 
                            accept=".json" 
                            onChange={handleImportRoster} 
                            className="hidden" 
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Settings and Roster calculations */}
                  <div className="flex flex-wrap items-center gap-4">
                    
                    {/* PIN modification area */}
                    {!activeParticipant.isLocked && (
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">Cambiar PIN (4 dígs)</span>
                        <div className="flex gap-1.5">
                          <input
                            type="password"
                            maxLength={4}
                            placeholder="Nuevo PIN"
                            value={newPinValue}
                            onChange={(e) => setNewPinValue(e.target.value)}
                            className="p-1 border text-center font-bold text-xs rounded w-24 bg-white"
                          />
                          <button
                            onClick={handleUpdatePin}
                            className="bg-[#5d1a33] text-white px-2 py-1 rounded text-xs font-black hover:bg-[#461124]"
                          >
                            Ok
                          </button>
                        </div>
                        {pinChangeSuccess && <span className="text-[10px] text-emerald-600 font-bold block">¡PIN Cambiado!</span>}
                      </div>
                    )}

                    {/* Breakdown of scores per Matchday inside logged in user */}
                    <div className="bg-[#fcf7f9] p-4 rounded-xl border border-rose-100 flex items-center gap-4">
                      <div className="text-center">
                        <span className="text-[10px] uppercase text-slate-500 font-bold block">Acumulado General</span>
                        <span className="text-2xl font-black text-[#5d1a33]">{getParticipantScore(activeParticipant, 'General').totalScore} pts</span>
                      </div>
                    </div>

                    <button
                      onClick={handleLogoutParticipant}
                      className="bg-slate-100 text-slate-700 px-4 py-3 rounded-xl text-xs font-black hover:bg-slate-200 border border-slate-300 flex items-center gap-1.5 transition-colors"
                    >
                      <LogOut size={14} /> Salir del Roster
                    </button>
                  </div>
                </div>

                {/* Banner alert if locked */}
                {activeParticipant.isLocked && (
                  <div className="bg-amber-50 text-amber-900 border border-amber-200 p-4 rounded-xl flex gap-3 items-start animate-pulse">
                    <Lock size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm">Tu plantilla está cerrada oficialmente</h4>
                      <p className="text-xs text-amber-800 mt-1">
                        Has enviado y guardado tu plantilla correctamente. El administrador ha sellado la participación para el inicio de las jornadas. Si necesitas un cambio urgente, ponte en contacto con el Admin del grupo.
                      </p>
                    </div>
                  </div>
                )}

                {/* TEAMS FORM */}
                <div className={`bg-white rounded-xl shadow border border-slate-200 overflow-hidden ${activeParticipant.isLocked ? 'opacity-80' : ''}`}>
                  <div className="bg-[#d1a1b4] text-slate-950 p-4 font-black text-lg border-b border-slate-300 flex justify-between items-center">
                    <span>SELECCIÓN DE EQUIPOS (ELEGIR 14)</span>
                    <span className="text-xs font-black bg-white/50 px-3 py-1 rounded-full">
                      Total seleccionados: {Object.values(activeParticipant.selectedTeams).flat().length} / 14
                    </span>
                  </div>

                  <div className="p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {Object.keys(OFFICIAL_TEAMS).map(group => {
                      const limit = TEAMS_LIMITS[group];
                      const selectedList = activeParticipant.selectedTeams[group] || [];
                      const isFull = selectedList.length === limit;

                      return (
                        <div key={group} className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col h-full">
                          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                            <span className="font-extrabold text-base text-slate-900">Grupo {group}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-black ${isFull ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {selectedList.length} / {limit}
                            </span>
                          </div>

                          <div className="space-y-1.5 flex-grow">
                            {OFFICIAL_TEAMS[group].map(team => {
                              const isChecked = selectedList.includes(team);
                              const isDisabled = ( !isChecked && isFull ) || activeParticipant.isLocked;

                              return (
                                <label 
                                  key={team} 
                                  className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${
                                    isChecked 
                                      ? 'bg-rose-50 border-rose-300 text-rose-950 font-black shadow-sm' 
                                      : isDisabled && !activeParticipant.isLocked
                                        ? 'bg-slate-100 border-transparent text-slate-400 cursor-not-allowed' 
                                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 cursor-pointer'
                                  }`}
                                >
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isDisabled}
                                    onChange={() => toggleTeamSelection(activeParticipant.id, group, team)}
                                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer disabled:cursor-not-allowed"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs truncate">{team}</div>
                                    {isChecked && (
                                      <span className="text-[10px] text-rose-600 font-bold block">
                                        Seleccionado
                                      </span>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* PLAYERS FORM */}
                <div className={`bg-white rounded-xl shadow border border-slate-200 overflow-hidden ${activeParticipant.isLocked ? 'opacity-80' : ''}`}>
                  <div className="bg-[#b3b9db] text-slate-950 p-4 font-black text-lg border-b border-slate-300 flex justify-between items-center">
                    <span>SELECCIÓN DE JUGADORES (ELEGIR 5)</span>
                    <span className="text-xs font-black bg-white/50 px-3 py-1 rounded-full">
                      Total seleccionados: {Object.values(activeParticipant.selectedPlayers).flat().length} / 5
                    </span>
                  </div>

                  <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Official G1, G2, G3 */}
                    {Object.keys(OFFICIAL_PLAYERS).map(group => {
                      const limit = PLAYERS_LIMITS[group];
                      const selectedList = activeParticipant.selectedPlayers[group] || [];
                      const totalCount = Object.values(activeParticipant.selectedPlayers).flat().length;
                      const isFull = selectedList.length === limit || totalCount >= 5;

                      return (
                        <div key={group} className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col h-full">
                          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                            <div>
                              <span className="font-extrabold text-base text-slate-900">Grupo {group.replace('G', '')}</span>
                              <span className="text-[10px] text-slate-500 block">Límite: Max {limit}</span>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-black ${selectedList.length === limit ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {selectedList.length} / {limit}
                            </span>
                          </div>

                          <div className="space-y-1.5 flex-grow overflow-y-auto max-h-72 pr-1">
                            {OFFICIAL_PLAYERS[group].map(player => {
                              const isChecked = selectedList.includes(player);
                              const isDisabled = ( !isChecked && isFull ) || activeParticipant.isLocked;

                              return (
                                <label 
                                  key={player}
                                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                    isChecked 
                                      ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-black shadow-sm' 
                                      : isDisabled && !activeParticipant.isLocked
                                        ? 'bg-slate-100 border-transparent text-slate-400 cursor-not-allowed' 
                                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                                  }`}
                                >
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isDisabled}
                                    onChange={() => togglePlayerSelection(activeParticipant.id, group, player)}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs truncate">{player}</div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Custom Player Column */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col h-full">
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                        <div>
                          <span className="font-extrabold text-base text-slate-900">Otro Jugador</span>
                          <span className="text-[10px] text-rose-600 font-bold block">No oficial en G1/G2/G3</span>
                        </div>
                        <span className="text-xs px-2 py-0.5 bg-slate-200 rounded-full font-black">
                          {activeParticipant.selectedPlayers.Otro?.length || 0}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 mb-3 italic">
                        Cualquier otro jugador no listado, siempre que no superes el límite total de 5.
                      </p>

                      {!activeParticipant.isLocked && (
                        <div className="flex gap-1.5 mb-4">
                          <input 
                            type="text"
                            placeholder="Nombre..."
                            value={customPlayerText}
                            onChange={(e) => setCustomPlayerText(e.target.value)}
                            disabled={Object.values(activeParticipant.selectedPlayers).flat().length >= 5}
                            className="flex-1 p-2 border border-slate-300 rounded-lg text-xs focus:outline-none bg-white"
                          />
                          <button 
                            onClick={() => addCustomPlayer(activeParticipant.id, false)}
                            disabled={Object.values(activeParticipant.selectedPlayers).flat().length >= 5 || !customPlayerText.trim()}
                            className="bg-indigo-700 text-white px-3 py-2 rounded-lg text-xs font-black hover:bg-indigo-800 disabled:opacity-50 transition-all shadow-sm"
                          >
                            Añadir
                          </button>
                        </div>
                      )}

                      <div className="space-y-1.5 flex-grow overflow-y-auto max-h-48 pr-1">
                        {(activeParticipant.selectedPlayers.Otro || []).map(player => (
                          <div key={player} className="flex justify-between items-center p-2 bg-white border border-slate-200 rounded-lg text-xs shadow-sm">
                            <div>
                              <span className="font-bold text-slate-800">{player}</span>
                            </div>
                            {!activeParticipant.isLocked && (
                              <button 
                                onClick={() => removeCustomPlayer(activeParticipant.id, player, false)}
                                className="text-red-500 hover:text-red-700 font-black text-xs px-1"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Confirm & Save Button for Participants */}
                {!activeParticipant.isLocked && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        saveParticipants(participants);
                        triggerConfirm(
                          "Guardado Exitoso",
                          "Tu plantilla ha sido guardada en la base de datos en la nube. Puedes seguir editándola libremente. El administrador será el encargado de bloquear las plantillas cuando se acerque el inicio del torneo.",
                          () => {}
                        );
                      }}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-black text-base shadow-md transition-all hover:scale-[1.02]"
                    >
                      <Save size={18} /> Guardar Plantilla en la Nube
                    </button>
                  </div>
                )}

              </div>
            )}

          </div>
        )}

        {/* ======================= TAB 3: ADMIN PANEL - GESTIÓN DE ROSTERS ======================= */}
        {isAdminMode && activeTab === 'admin_edit_roster' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 p-6 rounded-2xl shadow-lg">
              <h2 className="text-xl font-black flex items-center gap-2">
                <Shield size={22} /> MODO ADMIN: GESTIÓN DE ROSTERS INDIVIDUALES
              </h2>
              <p className="text-sm text-amber-950 mt-1 font-medium">
                Solo el administrador tiene permisos para editar o bloquear/desbloquear plantillas una vez guardadas. Selecciona un participante abajo para cambiar su alineación.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow p-6 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1 flex-1">
                <label className="text-xs uppercase tracking-wider text-slate-500 font-extrabold block">Selecciona un participante a gestionar:</label>
                <div className="flex items-center gap-3">
                  <select 
                    value={adminSelectedParticipantId}
                    onChange={(e) => setAdminSelectedParticipantId(parseInt(e.target.value))}
                    className="p-3 border border-slate-300 rounded-lg text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 w-full md:w-80 bg-white"
                  >
                    {participants.map(p => (
                      <option key={p.id} value={p.id}>
                        ID #{p.id} - {p.name} ({p.isLocked ? "Cerrado / Bloqueado" : "Abierto / Editable"})
                      </option>
                    ))}
                  </select>

                  {/* Lock/Unlock Toggle */}
                  {adminTargetParticipant?.isLocked ? (
                    <button
                      onClick={() => handleUnlockRosterByAdmin(adminTargetParticipant.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all flex-shrink-0"
                    >
                      <Unlock size={14} /> Desbloquear Formulario
                    </button>
                  ) : (
                    <button
                      onClick={() => handleLockRoster(adminTargetParticipant.id)}
                      className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all flex-shrink-0"
                    >
                      <Lock size={14} /> Bloquear Plantilla (Sellar)
                    </button>
                  )}
                </div>
              </div>

              {/* Roster statistics breakdown */}
              <div className="bg-slate-50 p-4 rounded-xl border flex items-center gap-6">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">PIN actual</span>
                  <span className="text-lg font-extrabold tracking-widest text-slate-900">{adminTargetParticipant?.pin}</span>
                </div>
                <div className="border-l pl-6">
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">Selección</span>
                  <span className="text-base font-extrabold text-slate-900">
                    {Object.values(adminTargetParticipant?.selectedTeams || {}).flat().length}/14 Eq. | {Object.values(adminTargetParticipant?.selectedPlayers || {}).flat().length}/5 Jug.
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Editable Teams Area */}
            {adminTargetParticipant && (
              <>
                <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                  <div className="bg-[#d1a1b4] text-slate-950 p-4 font-black text-base border-b border-slate-300 flex justify-between items-center">
                    <span>[ADMIN] EDITANDO EQUIPOS DE: {adminTargetParticipant.name.toUpperCase()}</span>
                    <span className="text-xs font-black bg-white/40 px-3 py-1 rounded-full">
                      {Object.values(adminTargetParticipant.selectedTeams).flat().length} / 14 Elegidos
                    </span>
                  </div>

                  <div className="p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {Object.keys(OFFICIAL_TEAMS).map(group => {
                      const limit = TEAMS_LIMITS[group];
                      const selectedList = adminTargetParticipant.selectedTeams[group] || [];
                      const isFull = selectedList.length === limit;

                      return (
                        <div key={group} className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col h-full">
                          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                            <span className="font-extrabold text-xs uppercase text-slate-600">Grupo {group} (Max {limit})</span>
                            <span className="text-xs font-bold">{selectedList.length}/{limit}</span>
                          </div>

                          <div className="space-y-1 flex-grow">
                            {OFFICIAL_TEAMS[group].map(team => {
                              const isChecked = selectedList.includes(team);
                              const isDisabled = !isChecked && isFull;

                              return (
                                <label 
                                  key={team} 
                                  className={`flex items-center gap-1.5 p-2 rounded text-xs transition-colors cursor-pointer ${
                                    isChecked ? 'bg-amber-100 text-amber-950 font-bold border border-amber-300' : 'bg-white border hover:bg-slate-100'
                                  }`}
                                >
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isDisabled}
                                    onChange={() => toggleTeamSelection(adminTargetParticipant.id, group, team, true)}
                                    className="w-3.5 h-3.5 rounded text-amber-600 cursor-pointer"
                                  />
                                  <span className="truncate">{team}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Direct Editable Players Area */}
                <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                  <div className="bg-[#b3b9db] text-slate-950 p-4 font-black text-base border-b border-indigo-200 flex justify-between items-center">
                    <span>[ADMIN] EDITANDO JUGADORES DE: {adminTargetParticipant.name.toUpperCase()}</span>
                    <span className="text-xs font-black bg-white/40 px-3 py-1 rounded-full">
                      {Object.values(adminTargetParticipant.selectedPlayers).flat().length} / 5 Elegidos
                    </span>
                  </div>

                  <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* G1, G2, G3 */}
                    {Object.keys(OFFICIAL_PLAYERS).map(group => {
                      const limit = PLAYERS_LIMITS[group];
                      const selectedList = adminTargetParticipant.selectedPlayers[group] || [];
                      const totalCount = Object.values(adminTargetParticipant.selectedPlayers).flat().length;
                      const isFull = selectedList.length === limit || totalCount >= 5;

                      return (
                        <div key={group} className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col h-full">
                          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                            <span className="font-extrabold text-xs uppercase text-slate-600">Grupo {group} (Max {limit})</span>
                            <span className="text-xs font-bold">{selectedList.length}/{limit}</span>
                          </div>

                          <div className="space-y-1 flex-grow overflow-y-auto max-h-60 pr-1">
                            {OFFICIAL_PLAYERS[group].map(player => {
                              const isChecked = selectedList.includes(player);
                              const isDisabled = !isChecked && isFull;

                              return (
                                <label 
                                  key={player}
                                  className={`flex items-center gap-1.5 p-2 rounded text-xs transition-colors cursor-pointer ${
                                    isChecked ? 'bg-amber-100 text-amber-950 font-bold border border-amber-300' : 'bg-white border hover:bg-slate-100'
                                  }`}
                                >
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isDisabled}
                                    onChange={() => togglePlayerSelection(adminTargetParticipant.id, group, player, true)}
                                    className="w-3.5 h-3.5 rounded text-amber-600 cursor-pointer"
                                  />
                                  <span className="truncate">{player}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Custom 'Otro' directly editable by Admin */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col h-full">
                      <span className="font-extrabold text-xs uppercase text-slate-600 mb-3 block border-b pb-2">Otro Jugador (Hasta llegar a 5)</span>
                      
                      <div className="flex gap-1.5 mb-3">
                        <input 
                          type="text"
                          placeholder="Nombre..."
                          value={customPlayerText}
                          onChange={(e) => setCustomPlayerText(e.target.value)}
                          disabled={Object.values(adminTargetParticipant.selectedPlayers).flat().length >= 5}
                          className="flex-1 p-2 border border-slate-300 rounded text-xs focus:outline-none"
                        />
                        <button 
                          onClick={() => addCustomPlayer(adminTargetParticipant.id, true)}
                          disabled={Object.values(adminTargetParticipant.selectedPlayers).flat().length >= 5 || !customPlayerText.trim()}
                          className="bg-amber-600 text-white px-2 py-1 rounded text-xs font-black hover:bg-amber-700"
                        >
                          Ok
                        </button>
                      </div>

                      <div className="space-y-1">
                        {(adminTargetParticipant.selectedPlayers.Otro || []).map(player => (
                          <div key={player} className="flex justify-between items-center p-2 bg-white border rounded text-xs">
                            <span className="truncate font-bold">{player}</span>
                            <button 
                              onClick={() => removeCustomPlayer(adminTargetParticipant.id, player, true)}
                              className="text-red-500 font-extrabold text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>
        )}

        {/* ======================= TAB 3.5: GESTIÓN DE PARTICIPANTES (CREAR / EDITAR / RESETEAR) ======================= */}
        {isAdminMode && activeTab === 'admin_participants_list' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 p-6 rounded-2xl shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-black flex items-center gap-2">
                  <UserPlus size={22} /> MODO ADMIN: GESTIÓN DE PARTICIPANTES
                </h2>
                <p className="text-sm text-amber-950 mt-1 font-medium">
                  Crea nuevos participantes para la porra, edita sus datos de acceso, o resetea el torneo por completo.
                </p>
              </div>
              <button
                onClick={() => {
                  triggerConfirm(
                    "RESETEAR TORNEO POR COMPLETO",
                    "Esta acción borrará todas las plantillas seleccionadas de los participantes y pondrá todas las estadísticas a 0. No se puede deshacer.",
                    handleResetTournamentData
                  );
                }}
                className="bg-red-800 hover:bg-red-900 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all self-start sm:self-auto"
              >
                Resetear Todo a Cero
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Form to Add New Participant */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 h-fit">
                <h3 className="font-extrabold text-slate-950 text-base border-b pb-2 uppercase tracking-wide">Añadir Participante</h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Nombre Completo / Nick</label>
                    <input 
                      type="text"
                      placeholder="Ej: Basti"
                      value={newParticipantName}
                      onChange={(e) => setNewParticipantName(e.target.value)}
                      className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none animate-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">PIN de Acceso (4 dígitos numéricos)</label>
                    <input 
                      type="text"
                      maxLength={4}
                      placeholder="0000"
                      value={newParticipantPin}
                      onChange={(e) => setNewParticipantPin(e.target.value)}
                      className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-center font-mono text-base font-bold tracking-widest"
                    />
                  </div>
                  <button 
                    onClick={handleAddParticipant}
                    disabled={!newParticipantName.trim()}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white p-2.5 rounded-lg font-black uppercase text-xs transition-colors disabled:opacity-50"
                  >
                    Crear Nuevo Registro
                  </button>
                </div>
              </div>

              {/* Edit Panel (Conditional) */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 h-fit">
                <h3 className="font-extrabold text-slate-950 text-base border-b pb-2 uppercase tracking-wide">Editar Participante Activo</h3>
                {editingParticipantId ? (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Nombre</label>
                      <input 
                        type="text"
                        value={editingParticipantName}
                        onChange={(e) => setEditingParticipantName(e.target.value)}
                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none animate-none"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Modificar PIN</label>
                      <input 
                        type="text"
                        maxLength={4}
                        value={editingParticipantPin}
                        onChange={(e) => setEditingParticipantPin(e.target.value)}
                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-center font-mono text-base font-bold tracking-widest"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditingParticipantId(null)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-bold"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={handleSaveParticipantEdit}
                        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg font-black"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Selecciona "Editar" en cualquiera de los participantes del listado de la derecha para modificarlo.</p>
                )}
              </div>

              {/* Participants list directory */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-1">
                <div className="p-4 bg-slate-50 border-b">
                  <h4 className="font-extrabold text-sm text-slate-800">Directorio de Participantes</h4>
                </div>
                <div className="divide-y max-h-96 overflow-y-auto">
                  {participants.map(p => (
                    <div key={p.id} className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs">
                      <div>
                        <span className="font-black text-slate-900 block">{p.name}</span>
                        <span className="text-[10px] text-slate-500 font-bold">PIN: {p.pin} | ID: #{p.id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleStartEditParticipant(p)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded font-bold hover:scale-105 transition-all"
                        >
                          Editar
                        </button>
                        <button 
                          onClick={() => {
                            triggerConfirm(
                              "Eliminar Participante",
                              `¿Estás seguro de que deseas eliminar a ${p.name}? Se perderán todos sus datos y plantilla de forma definitiva.`,
                              () => handleDeleteParticipant(p.id)
                            );
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ======================= TAB 4: ADMINISTRADOR - EQUIPOS (POR JORNADA) ======================= */}
        {isAdminMode && activeTab === 'admin_teams' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 p-6 rounded-2xl shadow-lg">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-xl font-black flex items-center gap-2">
                    <Shield size={22} /> MODULADOR STATS: EQUIPOS ELEGIDOS
                  </h2>
                  <p className="text-sm text-amber-950 mt-1 font-medium">
                    Selecciona primero la Jornada para cargar las victorias, empates y goles de los equipos correspondientes a esa ronda específica.
                  </p>
                </div>
                
                {/* GLOBAL IMPORT/EXPORT STATS FOR MATCHDAYS */}
                <div className="bg-amber-400 p-3 rounded-xl border border-amber-500/40 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase text-amber-950 block w-full mb-1">Copia General Jornadas:</span>
                  <button
                    onClick={handleExportAllStats}
                    className="bg-slate-900 hover:bg-slate-950 text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 shadow"
                  >
                    <Download size={12} /> Exportar Puntuaciones
                  </button>
                  <label className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 border border-slate-300 shadow cursor-pointer">
                    <Upload size={12} /> Importar Puntuaciones
                    <input 
                      type="file" 
                      accept=".json" 
                      onChange={handleImportAllStats} 
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>

              {/* Matchday Select in Admin */}
              <div className="mt-4 bg-[#4d1428] p-3 rounded-xl border border-amber-500/40">
                <label className="text-xs uppercase font-extrabold tracking-wider text-rose-100 block mb-1.5">Jornada Activa de Carga:</label>
                <div className="flex flex-wrap gap-1">
                  {JORNADAS.map(jor => (
                    <button
                      key={jor}
                      onClick={() => setAdminActiveJornada(jor)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${adminActiveJornada === jor ? 'bg-yellow-500 text-slate-950 font-black scale-105 shadow' : 'bg-[#5f1d35] hover:bg-[#722744] text-rose-100'}`}
                    >
                      {jor === 'Fase Final' ? 'Fase Final (Semis + Final)' : `Jornada ${jor}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Team search input */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <Search size={18} className="text-slate-400" />
              <input 
                type="text"
                placeholder="Buscar entre los equipos activos de la porra..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="flex-1 bg-transparent border-0 p-1 text-sm text-slate-800 focus:outline-none animate-none"
              />
              {teamSearch && (
                <button onClick={() => setTeamSearch('')} className="text-xs font-bold text-slate-500">Limpiar</button>
              )}
            </div>

            {/* List of teams and their score adjusters */}
            <div className="space-y-4">
              {filteredTeamsList.map(({ team, group }) => {
                const teamData = masterTeamStats[team] || { global: { p16: false, p8: false, p4: false, p2: false, p1: false } };
                const stats = teamData[adminActiveJornada] || { ...initialTeamStats };
                const currentTotal = getTeamPointsForJornada(team, group, adminActiveJornada);

                const isGroupStageAdmin = ['J1', 'J2', 'J3'].includes(adminActiveJornada);

                return (
                  <div key={team} className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                    
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <span className="font-black text-slate-900 text-lg">{team}</span>
                        <span className="text-xs bg-rose-100 text-rose-800 font-extrabold ml-2.5 px-2 py-0.5 rounded-full">
                          Grupo {group}
                        </span>
                      </div>
                      <div className="bg-rose-50 text-rose-900 font-black px-4 py-1.5 rounded-lg border border-rose-200 text-sm">
                        Total {adminActiveJornada}: <span className="text-lg font-black">{currentTotal} pts</span>
                      </div>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* 1. Dynamic Matchday Stats Loader */}
                      <div className="space-y-2">
                        <h4 className="font-extrabold text-xs text-[#5d1a33] uppercase tracking-wider pb-1.5 border-b flex items-center gap-1">
                          <Calendar size={14} /> Cargando Stats para Jornada {adminActiveJornada}
                        </h4>
                        
                        {isGroupStageAdmin ? (
                          /* Group stage controls (J1, J2, J3) */
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border">
                              <span className="font-bold text-slate-700">Victoria (+3)</span>
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => handleUpdateTeamStat(team, 'W', -1)} className="p-1 rounded bg-white border text-red-500"><Minus size={12} /></button>
                                <span className="text-sm font-black w-4 text-center">{stats.W || 0}</span>
                                <button onClick={() => handleUpdateTeamStat(team, 'W', 1)} className="p-1 rounded bg-white border text-emerald-500"><Plus size={12} /></button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border">
                              <span className="font-bold text-slate-700">Empate (+1)</span>
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => handleUpdateTeamStat(team, 'D', -1)} className="p-1 rounded bg-white border text-red-500"><Minus size={12} /></button>
                                <span className="text-sm font-black w-4 text-center">{stats.D || 0}</span>
                                <button onClick={() => handleUpdateTeamStat(team, 'D', 1)} className="p-1 rounded bg-white border text-emerald-500"><Plus size={12} /></button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border">
                              <span className="font-bold text-slate-700">G. Favor (+1)</span>
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => handleUpdateTeamStat(team, 'GF', -1)} className="p-1 rounded bg-white border text-red-500"><Minus size={12} /></button>
                                <span className="text-sm font-black w-4 text-center">{stats.GF || 0}</span>
                                <button onClick={() => handleUpdateTeamStat(team, 'GF', 1)} className="p-1 rounded bg-white border text-emerald-500"><Plus size={12} /></button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border">
                              <span className="font-bold text-slate-700">G. Contra (-1)</span>
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => handleUpdateTeamStat(team, 'GA', -1)} className="p-1 rounded bg-white border text-red-500"><Minus size={12} /></button>
                                <span className="text-sm font-black w-4 text-center">{stats.GA || 0}</span>
                                <button onClick={() => handleUpdateTeamStat(team, 'GA', 1)} className="p-1 rounded bg-white border text-emerald-500"><Plus size={12} /></button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Knockout controls (1/16, 1/8, 1/4, Fase Final) */
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded border">
                              <span className="font-bold text-slate-700">Ganar Regular (+5)</span>
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => handleUpdateTeamStat(team, 'WReg', -1)} className="p-1 rounded bg-white border text-red-500"><Minus size={10} /></button>
                                <span className="font-black w-4 text-center">{stats.WReg || 0}</span>
                                <button onClick={() => handleUpdateTeamStat(team, 'WReg', 1)} className="p-1 rounded bg-white border text-emerald-500"><Plus size={10} /></button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded border">
                              <span className="font-bold text-slate-700">Ganar Prórroga/Penaltis (+3)</span>
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => handleUpdateTeamStat(team, 'WET', -1)} className="p-1 rounded bg-white border text-red-500"><Minus size={10} /></button>
                                <span className="font-black w-4 text-center">{stats.WET || 0}</span>
                                <button onClick={() => handleUpdateTeamStat(team, 'WET', 1)} className="p-1 rounded bg-white border text-emerald-500"><Plus size={10} /></button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded border">
                              <span className="font-bold text-slate-700">Emp/Perd en Prórroga/Pen (+1)</span>
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => handleUpdateTeamStat(team, 'DLoss', -1)} className="p-1 rounded bg-white border text-red-500"><Minus size={10} /></button>
                                <span className="font-black w-4 text-center">{stats.DLoss || 0}</span>
                                <button onClick={() => handleUpdateTeamStat(team, 'DLoss', 1)} className="p-1 rounded bg-white border text-emerald-500"><Plus size={10} /></button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex items-center justify-between bg-slate-50 p-1 rounded border">
                                <span className="font-bold">G. Favor (+1)</span>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleUpdateTeamStat(team, 'GF', -1)} className="px-1 bg-white border"><Minus size={10} /></button>
                                  <span className="font-black text-xs">{stats.GF || 0}</span>
                                  <button onClick={() => handleUpdateTeamStat(team, 'GF', 1)} className="px-1 bg-white border"><Plus size={10} /></button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between bg-slate-50 p-1 rounded border">
                                <span className="font-bold">G. Contra (-1)</span>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleUpdateTeamStat(team, 'GA', -1)} className="px-1 bg-white border"><Minus size={10} /></button>
                                  <span className="font-black text-xs">{stats.GA || 0}</span>
                                  <button onClick={() => handleUpdateTeamStat(team, 'GA', 1)} className="px-1 bg-white border"><Plus size={10} /></button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. Extra Round Passes (ONLY for General standings calculation) */}
                      <div className="space-y-2 border-t md:border-t-0 md:border-l md:pl-6 border-slate-200">
                        <h4 className="font-extrabold text-xs text-amber-800 uppercase tracking-wider pb-1.5 border-b">
                          Pases de Ronda Extra (Sólo cuentan para la Clasificación General)
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          
                          <label className="flex items-center gap-2 p-2 bg-slate-50 rounded border cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={teamData.global?.p16 || false}
                              onChange={() => handleUpdateTeamStat(team, 'p16', 0, true)}
                              className="rounded cursor-pointer"
                            />
                            <div>
                              <span className="font-bold block">1/16</span>
                              <span className="text-[10px] text-rose-600">+{EXTRA_POINTS[group].p16} pts</span>
                            </div>
                          </label>

                          <label className="flex items-center gap-2 p-2 bg-slate-50 rounded border cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={teamData.global?.p8 || false}
                              onChange={() => handleUpdateTeamStat(team, 'p8', 0, true)}
                              className="rounded cursor-pointer"
                            />
                            <div>
                              <span className="font-bold block">1/8</span>
                              <span className="text-[10px] text-rose-600">+{EXTRA_POINTS[group].p8} pts</span>
                            </div>
                          </label>

                          <label className="flex items-center gap-2 p-2 bg-slate-50 rounded border cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={teamData.global?.p4 || false}
                              onChange={() => handleUpdateTeamStat(team, 'p4', 0, true)}
                              className="rounded cursor-pointer"
                            />
                            <div>
                              <span className="font-bold block">1/4</span>
                              <span className="text-[10px] text-rose-600">+{EXTRA_POINTS[group].p4} pts</span>
                            </div>
                          </label>

                          <label className="flex items-center gap-2 p-2 bg-slate-50 rounded border cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={teamData.global?.p2 || false}
                              onChange={() => handleUpdateTeamStat(team, 'p2', 0, true)}
                              className="rounded cursor-pointer"
                            />
                            <div>
                              <span className="font-bold block">1/2</span>
                              <span className="text-[10px] text-rose-600">+{EXTRA_POINTS[group].p2} pts</span>
                            </div>
                          </label>

                          <label className="col-span-2 flex items-center gap-2 p-2 bg-amber-50 rounded border-amber-200 border cursor-pointer animate-none">
                            <input 
                              type="checkbox" 
                              checked={teamData.global?.p1 || false}
                              onChange={() => handleUpdateTeamStat(team, 'p1', 0, true)}
                              className="rounded cursor-pointer"
                            />
                            <div>
                              <span className="font-bold block text-amber-950 font-black">Llegar a la Final</span>
                              <span className="text-[10px] text-rose-700">+{EXTRA_POINTS[group].p1} pts</span>
                            </div>
                          </label>

                        </div>
                      </div>

                    </div>

                  </div>
                );
              })}

              {filteredTeamsList.length === 0 && (
                <div className="bg-white p-12 rounded-xl text-center border text-slate-500">
                  <Activity size={32} className="mx-auto text-slate-400 mb-2" />
                  <span>No hay equipos activos elegidos por los participantes en tu porra.</span>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ======================= TAB 5: ADMINISTRADOR - JUGADORES (POR JORNADA) ======================= */}
        {isAdminMode && activeTab === 'admin_players' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 p-6 rounded-2xl shadow-lg">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-xl font-black flex items-center gap-2">
                    <Shield size={22} /> MODULADOR STATS: JUGADORES ELEGIDOS
                  </h2>
                  <p className="text-sm text-amber-950 mt-1 font-medium">
                    Selecciona la jornada correspondiente para actualizar las estadísticas de juego (goles, tarjetas, MVPs) que obtengan los jugadores.
                  </p>
                </div>

                {/* GLOBAL IMPORT/EXPORT STATS FOR MATCHDAYS */}
                <div className="bg-amber-400 p-3 rounded-xl border border-amber-500/40 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase text-amber-950 block w-full mb-1">Copia General Jornadas:</span>
                  <button
                    onClick={handleExportAllStats}
                    className="bg-slate-900 hover:bg-slate-950 text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 shadow"
                  >
                    <Download size={12} /> Exportar Puntuaciones
                  </button>
                  <label className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 border border-slate-300 shadow cursor-pointer">
                    <Upload size={12} /> Importar Puntuaciones
                    <input 
                      type="file" 
                      accept=".json" 
                      onChange={handleImportAllStats} 
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>

              {/* Matchday Select in Admin */}
              <div className="mt-4 bg-[#4d1428] p-3 rounded-xl border border-amber-500/40">
                <label className="text-xs uppercase font-extrabold tracking-wider text-rose-100 block mb-1.5">Jornada Activa de Carga:</label>
                <div className="flex flex-wrap gap-1">
                  {JORNADAS.map(jor => (
                    <button
                      key={jor}
                      onClick={() => setAdminActiveJornada(jor)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${adminActiveJornada === jor ? 'bg-yellow-500 text-slate-950 font-black scale-105 shadow' : 'bg-[#5f1d35] hover:bg-[#722744] text-rose-100'}`}
                    >
                      {jor === 'Fase Final' ? 'Fase Final (Semis + Final)' : `Jornada ${jor}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Player search input */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <Search size={18} className="text-slate-400" />
              <input 
                type="text"
                placeholder="Buscar entre los jugadores activos (Oficiales y Otros)..."
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                className="flex-1 bg-transparent border-0 p-1 text-sm text-slate-800 focus:outline-none animate-none"
              />
              {playerSearch && (
                <button onClick={() => setPlayerSearch('')} className="text-xs font-bold text-slate-500">Limpiar</button>
              )}
            </div>

            {/* List of players and their stat controls */}
            <div className="space-y-4">
              {filteredPlayersList.map(({ player, group }) => {
                const playerData = masterPlayerStats[player] || { global: { bota: false, balon: false } };
                const stats = playerData[adminActiveJornada] || { ...initialPlayerStats };
                const currentTotal = getPlayerPointsForJornada(player, adminActiveJornada);

                return (
                  <div key={player} className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                    
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <span className="font-black text-slate-900 text-lg">{player}</span>
                        <span className="text-xs bg-indigo-100 text-indigo-800 font-extrabold ml-2.5 px-2 py-0.5 rounded-full">
                          {group === 'Otro' ? 'Otro Jugador (Introducido)' : `Grupo ${group.replace('G','')}`}
                        </span>
                      </div>
                      <div className="bg-indigo-50 text-indigo-900 font-black px-4 py-1.5 rounded-lg border border-indigo-200 text-sm">
                        Total {adminActiveJornada}: <span className="text-lg font-black">{currentTotal} pts</span>
                      </div>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* 1. Dynamic Matchday Stats Loader */}
                      <div className="space-y-2">
                        <h4 className="font-extrabold text-xs text-[#5d1a33] uppercase tracking-wider pb-1.5 border-b">
                          Stats de Juego (Jornada {adminActiveJornada})
                        </h4>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded border">
                            <span className="font-bold">Goles (+1)</span>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => handleUpdatePlayerStat(player, 'G', -1)} className="p-1 rounded bg-white border text-red-500"><Minus size={10} /></button>
                              <span className="font-black w-4 text-center">{stats.G || 0}</span>
                              <button onClick={() => handleUpdatePlayerStat(player, 'G', 1)} className="p-1 rounded bg-white border text-emerald-500"><Plus size={10} /></button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded border">
                            <span className="font-bold">MVP de Partido (+2)</span>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => handleUpdatePlayerStat(player, 'MVP', -1)} className="p-1 rounded bg-white border text-red-500"><Minus size={10} /></button>
                              <span className="font-black w-4 text-center">{stats.MVP || 0}</span>
                              <button onClick={() => handleUpdatePlayerStat(player, 'MVP', 1)} className="p-1 rounded bg-white border text-emerald-500"><Plus size={10} /></button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-1 mt-1">
                            <div className="bg-yellow-50 p-1 rounded border border-yellow-200 text-center">
                              <span className="font-bold block text-[9px] text-yellow-800">Am. (-1)</span>
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <button onClick={() => handleUpdatePlayerStat(player, 'Y', -1)} className="text-[9px] px-1 bg-white border">-</button>
                                <span className="font-black text-xs">{stats.Y || 0}</span>
                                <button onClick={() => handleUpdatePlayerStat(player, 'Y', 1)} className="text-[9px] px-1 bg-white border">+</button>
                              </div>
                            </div>
                            <div className="bg-orange-50 p-1 rounded border border-orange-200 text-center">
                              <span className="font-bold block text-[9px] text-orange-800">2x Am. (-2)</span>
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <button onClick={() => handleUpdatePlayerStat(player, 'DY', -1)} className="text-[9px] px-1 bg-white border">-</button>
                                <span className="font-black text-xs">{stats.DY || 0}</span>
                                <button onClick={() => handleUpdatePlayerStat(player, 'DY', 1)} className="text-[9px] px-1 bg-white border">+</button>
                              </div>
                            </div>
                            <div className="bg-red-50 p-1 rounded border border-red-200 text-center">
                              <span className="font-bold block text-[9px] text-red-800">Roja (-3)</span>
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <button onClick={() => handleUpdatePlayerStat(player, 'R', -1)} className="text-[9px] px-1 bg-white border">-</button>
                                <span className="font-black text-xs">{stats.R || 0}</span>
                                <button onClick={() => handleUpdatePlayerStat(player, 'R', 1)} className="text-[9px] px-1 bg-white border">+</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 2. Special Awards (ONLY for General standings) */}
                      <div className="space-y-2 border-t md:border-t-0 md:border-l md:pl-6 border-slate-200">
                        <h4 className="font-extrabold text-xs text-indigo-900 uppercase tracking-wider pb-1.5 border-b">
                          Premios Especiales (Sólo cuentan para la Clasificación General)
                        </h4>
                        <div className="flex flex-col gap-2 text-xs">
                          
                          <label className="flex items-center gap-2.5 p-3 bg-amber-50 rounded border border-amber-200 cursor-pointer hover:bg-amber-100/50 transition-colors">
                            <input 
                              type="checkbox" 
                              checked={playerData.global?.bota || false}
                              onChange={() => handleUpdatePlayerStat(player, 'bota', 0, true)}
                              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer animate-none"
                            />
                            <div>
                              <span className="font-extrabold text-amber-900 block">Bota de Oro (+10)</span>
                              <span className="text-[10px] text-amber-700">Puntos generales</span>
                            </div>
                          </label>

                          <label className="flex items-center gap-2.5 p-3 bg-yellow-50 rounded border border-yellow-200 cursor-pointer hover:bg-yellow-100/50 transition-colors">
                            <input 
                              type="checkbox" 
                              checked={playerData.global?.balon || false}
                              onChange={() => handleUpdatePlayerStat(player, 'balon', 0, true)}
                              className="w-4 h-4 rounded text-yellow-600 focus:ring-yellow-500 cursor-pointer animate-none"
                            />
                            <div>
                              <span className="font-extrabold text-yellow-950 block">Balón de Oro (+20)</span>
                              <span className="text-[10px] text-yellow-800">Puntos generales</span>
                            </div>
                          </label>

                        </div>
                      </div>

                    </div>

                  </div>
                );
              })}

              {filteredPlayersList.length === 0 && (
                <div className="bg-white p-12 rounded-xl text-center border text-slate-500">
                  <Star size={32} className="mx-auto text-slate-400 mb-2" />
                  <span>No hay jugadores activos elegidos por los participantes en tu porra.</span>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* ======================= ADMIN PASSWORD SECURITY DIALOG ======================= */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 border-b pb-3 text-[#5d1a33]">
              <Shield className="animate-bounce" size={24} />
              <h3 className="text-lg font-black uppercase tracking-tight">Acceso Administrador</h3>
            </div>
            
            <p className="text-xs text-slate-500">
              Introduce la clave maestra de acceso fija para gestionar plantillas de participantes y cargar estadísticas de torneos.
            </p>

            <div className="space-y-3">
              <input 
                type="password"
                placeholder="Código de acceso..."
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdminLogin();
                }}
                className="w-full p-3 border rounded-xl text-center text-lg font-black tracking-widest bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#5d1a33]"
              />

              {adminError && (
                <div className="text-red-700 bg-red-50 p-2.5 rounded text-xs font-semibold border border-red-200">
                  {adminError}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setShowAdminModal(false);
                  setAdminPasswordInput('');
                  setAdminError('');
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg text-xs font-black"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAdminLogin}
                className="flex-1 bg-[#5d1a33] hover:bg-[#461124] text-white py-2.5 rounded-lg text-xs font-black"
              >
                Ingresar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= SPIED LOCKED ROSTER VIEWER MODAL ======================= */}
      {spiedParticipant && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-6">
            
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <span className="text-[10px] bg-rose-100 text-rose-800 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                  Plantilla Bloqueada (Oficial)
                </span>
                <h3 className="text-2xl font-black text-slate-900 mt-1">Selección de {spiedParticipant.name}</h3>
                <p className="text-xs text-slate-500">
                  Puntuación para la etapa: <strong className="text-rose-800 uppercase font-black">{activeJornada}</strong>
                </p>
              </div>
              <button 
                onClick={() => setSpiedParticipant(null)}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full font-black text-xs"
              >
                ✕ Cerrar
              </button>
            </div>

            {/* Scores summary in Spied Participant */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Ptos Equipos</span>
                <span className="text-lg font-black text-rose-700">{getParticipantScore(spiedParticipant, activeJornada).teamsScore} pts</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Ptos Jugadores</span>
                <span className="text-lg font-black text-indigo-700">{getParticipantScore(spiedParticipant, activeJornada).playersScore} pts</span>
              </div>
              <div className="bg-[#5d1a33]/10 p-3 rounded-xl border border-rose-200">
                <span className="text-[10px] font-black text-rose-900 uppercase block">Puntos Totales ({activeJornada})</span>
                <span className="text-lg font-black text-[#5d1a33]">{getParticipantScore(spiedParticipant, activeJornada).totalScore} pts</span>
              </div>
            </div>

            {/* Teams Selected and Points */}
            <div className="space-y-2">
              <h4 className="font-extrabold text-sm text-[#5d1a33] uppercase tracking-wider pb-1.5 border-b">
                Alineación de Equipos (14 seleccionados)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {Object.keys(spiedParticipant.selectedTeams).map(group => {
                  const selectedList = spiedParticipant.selectedTeams[group] || [];
                  return selectedList.map(team => {
                    const pts = getTeamPointsForJornada(team, group, activeJornada);
                    
                    // Deriving extra round bonuses
                    let bonusText = "";
                    if (activeJornada === 'General') {
                      const bonuses = masterTeamStats[team]?.global;
                      if (bonuses) {
                        const rates = EXTRA_POINTS[group];
                        const bonusArr = [];
                        if (bonuses.p16) bonusArr.push(`1/16(+${rates.p16})`);
                        if (bonuses.p8) bonusArr.push(`1/8(+${rates.p8})`);
                        if (bonuses.p4) bonusArr.push(`1/4(+${rates.p4})`);
                        if (bonuses.p2) bonusArr.push(`1/2(+${rates.p2})`);
                        if (bonuses.p1) bonusArr.push(`Fin(+${rates.p1})`);
                        if (bonusArr.length > 0) bonusText = bonusArr.join(', ');
                      }
                    }

                    return (
                      <div key={team} className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-black text-rose-800 uppercase block">Grupo {group}</span>
                          <span className="font-black text-slate-800 text-sm">{team}</span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-rose-100 flex justify-between items-end">
                          <span className="text-[9px] text-slate-500 font-medium max-w-[80px] truncate" title={bonusText}>{bonusText || 'Sin extras'}</span>
                          <span className="text-xs font-black text-rose-800">{pts} pts</span>
                        </div>
                      </div>
                    );
                  });
                })}
              </div>
            </div>

            {/* Players Selected and Points */}
            <div className="space-y-2">
              <h4 className="font-extrabold text-sm text-indigo-900 uppercase tracking-wider pb-1.5 border-b">
                Alineación de Jugadores (5 seleccionados)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {Object.keys(spiedParticipant.selectedPlayers).map(group => {
                  const selectedList = spiedParticipant.selectedPlayers[group] || [];
                  return selectedList.map(player => {
                    const pts = getPlayerPointsForJornada(player, activeJornada);

                    // Deriving Golden boot/ball award bonuses
                    let bonusText = "";
                    if (activeJornada === 'General') {
                      const bonuses = masterPlayerStats[player]?.global;
                      if (bonuses) {
                        const bonusArr = [];
                        if (bonuses.bota) bonusArr.push('Bota Oro(+10)');
                        if (bonuses.balon) bonusArr.push('Balón Oro(+20)');
                        if (bonusArr.length > 0) bonusText = bonusArr.join(', ');
                      }
                    }

                    return (
                      <div key={player} className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-black text-indigo-800 uppercase block">
                            {group === 'Otro' ? 'Otro' : `Grupo ${group.replace('G','')}`}
                          </span>
                          <span className="font-black text-slate-800 text-sm">{player}</span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-indigo-100 flex justify-between items-end">
                          <span className="text-[9px] text-slate-500 font-medium" title={bonusText}>{bonusText || 'Sin extras'}</span>
                          <span className="text-xs font-black text-indigo-800">{pts} pts</span>
                        </div>
                      </div>
                    );
                  });
                })}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <button 
                onClick={() => setSpiedParticipant(null)}
                className="bg-[#5d1a33] hover:bg-[#461124] text-white px-6 py-2 rounded-xl font-black text-xs"
              >
                Cerrar Roster
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ======================= CUSTOM INTERACTIVE CONFIRMATION MODAL ======================= */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-700 border-b pb-3">
              <AlertTriangle className="animate-pulse" size={24} />
              <h3 className="text-lg font-black uppercase tracking-tight">{confirmModal.title}</h3>
            </div>
            
            <p className="text-sm text-slate-600 font-medium">
              {confirmModal.message}
            </p>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmModal.onConfirm}
                className="flex-1 bg-rose-700 hover:bg-rose-800 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}