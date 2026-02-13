import { db } from "~/server/db";


export async function checkAndUpdateQuota(
    userId: string,
    deductFromQuota: boolean = true,
) : Promise<boolean> {
    
    const quota = await db.apiQuota.findUniqueOrThrow({
        where: {userId}
    })

    const now = new Date()
    const lastReset = new Date(quota.lastResetDate)
    const daysSinceLastReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24)

    if(daysSinceLastReset >= 30) {
        if(deductFromQuota) {
            await db.apiQuota.update({
                where: {userId},
                data: {
                    lastResetDate: now,
                    requestUsed: 1,
                }
            })
        }

        return true;
    }

    //check if quota has exceeded
    if(quota.requestUsed > quota.maxRequests) {
        return false;
    }

    if(deductFromQuota) {
        await db.apiQuota.update({
            where: {userId},
            data: {
                requestUsed: quota.requestUsed + 1
            }
        })
    }

    return true
}