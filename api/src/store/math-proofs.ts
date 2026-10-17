import type {DatabaseSync} from 'node:sqlite';
import {randomInt,randomUUID} from 'node:crypto';
import {ApiError} from '../middlewares/error-handler.js';
export function mathProofs(db:DatabaseSync,now:()=>number){
 db.exec(`CREATE TABLE IF NOT EXISTS math_problems(id TEXT PRIMARY KEY,challenge_id TEXT NOT NULL REFERENCES challenges(id),left_value INTEGER NOT NULL,right_value INTEGER NOT NULL,created_at TEXT NOT NULL,submitted_answer TEXT,result TEXT);
 CREATE UNIQUE INDEX IF NOT EXISTS math_one_active ON math_problems(challenge_id) WHERE result IS NULL;`);
 const receipt=(row:ReturnType<ReturnType<DatabaseSync['prepare']>['get']>)=>row?.result?JSON.parse(String(row.result)):null;
 return {
  mathAccepted(challengeId:string){return db.prepare("SELECT result FROM math_problems WHERE challenge_id=? AND json_extract(result,'$.status')='accepted' LIMIT 1").get(challengeId)!==undefined;},
  getMathReceipt(challengeId:string,problemId:string){
   const row=db.prepare('SELECT submitted_answer,result FROM math_problems WHERE id=? AND challenge_id=?').get(problemId,challengeId);
   return row?.result?{answer:String(row.submitted_answer),proof:receipt(row)}:null;
  },
  createMathProblem(challengeId:string){
   db.prepare('INSERT OR IGNORE INTO math_problems(id,challenge_id,left_value,right_value,created_at) VALUES(?,?,?,?,?)').run(randomUUID(),challengeId,randomInt(10,100),randomInt(10,100),new Date(now()).toISOString());
   const row=db.prepare('SELECT * FROM math_problems WHERE challenge_id=? AND result IS NULL').get(challengeId)!;
   return {id:String(row.id),left:Number(row.left_value),right:Number(row.right_value),operator:'+',createdAt:String(row.created_at)};
  },
  submitMath(challengeId:string,problemId:string,answer:string){
   db.exec('BEGIN IMMEDIATE');
   try{
    const row=db.prepare('SELECT * FROM math_problems WHERE challenge_id=? AND id=?').get(challengeId,problemId);
    if(!row)throw new ApiError(404,'Problem not found.','NOT_FOUND');
    if(row.result){
     if(String(row.submitted_answer)!==answer)throw new ApiError(409,'This problem already has a submitted answer.','PROBLEM_USED');
     db.exec('COMMIT');return receipt(row);
    }
    if(db.prepare("SELECT id FROM math_problems WHERE challenge_id=? AND json_extract(result,'$.status')='accepted'").get(challengeId))throw new ApiError(409,'This challenge already has an accepted proof.','PROOF_ACCEPTED');
    const challengeRow=db.prepare('SELECT result FROM challenges WHERE id=?').get(challengeId);
    const challenge=JSON.parse(String(challengeRow?.result));
    const submittedAt=now();
    if(submittedAt<Date.parse(challenge.startsAt)||submittedAt>=Date.parse(challenge.proofDeadline))throw new ApiError(409,'The proof window is not open.','PROOF_WINDOW_CLOSED');
    const accepted=Number(answer)===Number(row.left_value)+Number(row.right_value);
    const proof={problemId,answer,status:accepted?'accepted':'rejected',submittedAt:new Date(submittedAt).toISOString(),reason:accepted?'Correct answer received during the proof window.':'The answer is incorrect. Request a fresh problem before the deadline.'};
    db.prepare('UPDATE math_problems SET submitted_answer=?,result=? WHERE id=?').run(answer,JSON.stringify(proof),problemId);
    db.exec('COMMIT');return proof;
   }catch(e){db.exec('ROLLBACK');throw e;}
  },
  listMathProofs(challengeId:string){return db.prepare('SELECT result FROM math_problems WHERE challenge_id=? AND result IS NOT NULL ORDER BY created_at,id').all(challengeId).map(row=>receipt(row));}
 };
}
