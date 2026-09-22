import {
  doc, getDoc, setDoc, deleteDoc, addDoc, collection, query, where, orderBy, onSnapshot, writeBatch,
} from 'firebase/firestore';
import { db } from '../src/lib/firebase';
import { FriendProfile, FriendRequest, DirectMessage } from '../types';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid ambiguity

const randomCode = (): string =>
  Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export const pairId = (a: string, b: string): string => (a < b ? `${a}_${b}` : `${b}_${a}`);

// Returns this user's existing friend code, or mints a new one (retrying on
// the rare collision) and stores the code->uid mapping in userDirectory.
export const ensureFriendCode = async (uid: string): Promise<string> => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  const existing = userSnap.data()?.friendCode;
  if (typeof existing === 'string' && existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      await setDoc(doc(db, 'userDirectory', code), { uid });
      await setDoc(userRef, { friendCode: code }, { merge: true });
      return code;
    } catch {
      // Code already taken by someone else — try another one.
    }
  }
  throw new Error('Não foi possível gerar um código de amigo. Tente novamente.');
};

export interface PublicProfileInput {
  name: string;
  avatarColor: string;
  characterId?: string;
  level: number;
  xp: number;
  status: 'ONLINE' | 'STUDYING' | 'OFFLINE';
}

export const syncPublicProfile = async (uid: string, profile: PublicProfileInput): Promise<void> => {
  await setDoc(doc(db, 'publicProfiles', uid), { ...profile, lastActive: Date.now() }, { merge: true });
};

export const lookupUserByCode = async (code: string): Promise<{ uid: string; name: string } | null> => {
  const dirSnap = await getDoc(doc(db, 'userDirectory', code.trim().toUpperCase()));
  const uid = dirSnap.data()?.uid as string | undefined;
  if (!uid) return null;
  const profileSnap = await getDoc(doc(db, 'publicProfiles', uid));
  const name = profileSnap.data()?.name as string | undefined;
  return { uid, name: name || 'Estudante' };
};

export const sendFriendRequest = async (
  fromUid: string, fromName: string, fromAvatarColor: string, toUid: string
): Promise<void> => {
  if (fromUid === toUid) throw new Error('Você não pode adicionar você mesmo.');
  await setDoc(doc(db, 'friendRequests', `${fromUid}_${toUid}`), {
    fromUid, toUid, fromName, fromAvatarColor, createdAt: Date.now(),
  });
};

export const respondFriendRequest = async (request: FriendRequest, myUid: string, accept: boolean): Promise<void> => {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'friendRequests', request.id));
  if (accept) {
    const id = pairId(request.fromUid, request.toUid);
    batch.set(doc(db, 'friendships', id), {
      participants: [request.fromUid, request.toUid],
      createdAt: Date.now(),
    });
  }
  await batch.commit();
};

export const cancelFriendRequest = async (requestId: string): Promise<void> => {
  await deleteDoc(doc(db, 'friendRequests', requestId));
};

export const removeFriend = async (friendshipId: string): Promise<void> => {
  await deleteDoc(doc(db, 'friendships', friendshipId));
};

export const listenFriendRequests = (
  uid: string, direction: 'incoming' | 'outgoing', cb: (requests: FriendRequest[]) => void
): (() => void) => {
  const field = direction === 'incoming' ? 'toUid' : 'fromUid';
  const q = query(collection(db, 'friendRequests'), where(field, '==', uid));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FriendRequest, 'id'>) })));
  });
};

// Listens to this user's friendships and keeps a live profile subscription
// for each friend, emitting the combined list whenever anything changes.
export const listenFriends = (myUid: string, cb: (friends: FriendProfile[]) => void): (() => void) => {
  const profileUnsubs = new Map<string, () => void>();
  const profiles = new Map<string, FriendProfile>();
  const emit = () => cb(Array.from(profiles.values()));

  const friendshipsQ = query(collection(db, 'friendships'), where('participants', 'array-contains', myUid));
  const unsubFriendships = onSnapshot(friendshipsQ, (snap) => {
    const friendUids = new Set<string>(
      snap.docs.map((d) => (d.data().participants as string[]).find((p) => p !== myUid)).filter(Boolean) as string[]
    );

    for (const [uid, unsub] of profileUnsubs) {
      if (!friendUids.has(uid)) {
        unsub();
        profileUnsubs.delete(uid);
        profiles.delete(uid);
      }
    }

    friendUids.forEach((friendUid) => {
      if (profileUnsubs.has(friendUid)) return;
      const unsub = onSnapshot(doc(db, 'publicProfiles', friendUid), (profSnap) => {
        const data = profSnap.data();
        if (!data) return;
        profiles.set(friendUid, {
          id: friendUid,
          name: data.name,
          avatarColor: data.avatarColor,
          characterId: data.characterId,
          level: data.level,
          xp: data.xp,
          status: data.status,
          lastActive: data.lastActive,
        });
        emit();
      });
      profileUnsubs.set(friendUid, unsub);
    });
    emit();
  });

  return () => {
    unsubFriendships();
    profileUnsubs.forEach((unsub) => unsub());
  };
};

export const sendMessage = async (chatId: string, senderId: string, senderName: string, text: string): Promise<void> => {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    senderId, senderName, text: trimmed, timestamp: Date.now(),
  });
};

export const listenMessages = (chatId: string, cb: (messages: DirectMessage[]) => void): (() => void) => {
  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DirectMessage, 'id'>) })));
  });
};
