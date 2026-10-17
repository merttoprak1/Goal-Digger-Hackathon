import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
export interface Participant {id:string;displayName:string;createdAt:string}
export function openSessions(databasePath:string,now:()=>number=Date.now){
 mkdirSync(dirname(databasePath),{recursive:true,mode:0o700});
 const db=new DatabaseSync(databasePath);chmodSync(databasePath,0o600);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS participants(id TEXT PRIMARY KEY,display_name TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,participant_id TEXT NOT NULL REFERENCES participants(id),expires_at INTEGER NOT NULL);`);
 const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
 return {
  create(displayName:string){
   const participant:Participant={id:randomUUID(),displayName,createdAt:new Date(now()).toISOString()};
   const token=randomBytes(32).toString('hex');const expiresAt=now()+7*24*60*60*1000;
   db.exec('BEGIN IMMEDIATE');
   try{
    db.prepare('INSERT INTO participants VALUES(?,?,?)').run(participant.id,displayName,participant.createdAt);
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),participant.id,expiresAt);db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
   return {participant,token,expiresAt:new Date(expiresAt).toISOString()};
  },
  find(token:string):Participant|null{
   if(!/^[a-f0-9]{64}$/.test(token))return null;
   const row=db.prepare('SELECT p.* FROM sessions s JOIN participants p ON p.id=s.participant_id WHERE s.token_hash=? AND s.expires_at>?').get(hash(token),now());
   return row?{id:String(row.id),displayName:String(row.display_name),createdAt:String(row.created_at)}:null;
  },
  revoke(token:string){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));},
  close(){db.close();}
 };
}
