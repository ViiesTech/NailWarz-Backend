const cron = require('node-cron');
const battleModel = require('../models/battle.js');
const { BATTLE_STATUS } = require('../constants/battleStatus.js');

const battleCronJob = () => {

  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      /* ======================
         START BATTLES
      ====================== */
      const battlesToStart = await battleModel.find({
        status: BATTLE_STATUS.UPCOMING,
        startDate: { $lte: now }
      }).select('_id name');

      if (battlesToStart.length > 0) {
        await battleModel.updateMany(
          { _id: { $in: battlesToStart.map(b => b._id) } },
          { $set: { status: BATTLE_STATUS.ACTIVE } }
        );

        console.log("🟢 Battles Started:");
        battlesToStart.forEach(b =>
          console.log(`   ▶ ${b.name} (${b._id})`)
        );
      }

      /* ======================
         END BATTLES & SET WINNER
      ====================== */
      const battlesToEnd = await battleModel.find({
        status: BATTLE_STATUS.ACTIVE,
        endDate: { $lte: now }
      });

      for (const battle of battlesToEnd) {

        // 🔹 Get max votes
        const maxVotes = Math.max(
          ...battle.participants.map(p => p.vote.length)
        );

        // 🔹 Participants with max votes
        const topParticipants = battle.participants.filter(
          p => p.vote.length === maxVotes
        );

        // 🟡 TIE CASE → EXTEND 10 MINUTES
        if (topParticipants.length > 1) {
          battle.endDate = new Date(
            battle.endDate.getTime() + 10 * 60 * 1000
          );

          await battle.save();

          console.log("⏱ Battle extended due to tie:");
          console.log(`   ↻ ${battle.name} (${battle._id})`);
          continue; // do NOT end battle
        }

        // 🟢 CLEAR WINNER
        battle.status = BATTLE_STATUS.COMPLETED;
        battle.winner = topParticipants[0].participant;
        await battle.save();

        console.log("🔴 Battle Ended:");
        console.log(`   ⏹ ${battle.name} (${battle._id})`);
        console.log(`   🏆 Winner: ${battle.winner.name} (${battle.winner.email})`);
      }

      if (!battlesToStart.length && !battlesToEnd.length) {
        console.log("🕒 Battle cron run — no changes");
      }

    } catch (error) {
      console.error("❌ Battle cron error:", error);
    }
  });
};

module.exports = battleCronJob;
