const aiNurtureJobRunner = require('./aiNurtureJobRunner');

let workerStarted = false;
let workerTimer = null;
let workerRunning = false;

function isEnabled() {
    return String(process.env.AI_NURTURE_WORKER_ENABLED || 'true').trim().toLowerCase() !== 'false';
}

function intervalMs() {
    const parsed = Number.parseInt(process.env.AI_NURTURE_WORKER_INTERVAL_MS, 10);
    return Number.isFinite(parsed) && parsed >= 5000 ? parsed : 45000;
}

function batchSize() {
    const parsed = Number.parseInt(process.env.AI_NURTURE_WORKER_BATCH_SIZE, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
}

async function runWorkerTick() {
    if (workerRunning) return;
    workerRunning = true;

    try {
        for (let i = 0; i < batchSize(); i += 1) {
            const outcome = await aiNurtureJobRunner.runNextQueuedJob();
            if (!outcome?.job) break;

            console.log(
                `[AI NURTURE WORKER] processed job=${outcome.job.id} source=${outcome.job.sourceId || 'n/a'}`
            );
        }
    } catch (error) {
        console.error('[AI NURTURE WORKER] tick failed:', error.message);
    } finally {
        workerRunning = false;
    }
}

function startAiNurtureWorker() {
    if (workerStarted || !isEnabled()) return;

    workerStarted = true;

    console.log(
        `[AI NURTURE WORKER] starting interval=${intervalMs()}ms batch=${batchSize()}`
    );

    runWorkerTick().catch((error) => {
        console.error('[AI NURTURE WORKER] initial tick failed:', error.message);
    });

    workerTimer = setInterval(() => {
        runWorkerTick().catch((error) => {
            console.error('[AI NURTURE WORKER] scheduled tick failed:', error.message);
        });
    }, intervalMs());
}

function stopAiNurtureWorker() {
    if (workerTimer) {
        clearInterval(workerTimer);
        workerTimer = null;
    }
    workerStarted = false;
}

module.exports = {
    startAiNurtureWorker,
    stopAiNurtureWorker
};