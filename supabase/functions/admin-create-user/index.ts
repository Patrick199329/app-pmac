import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const body = await req.json()
        const { action, targetUserId, name, email, password, partnerId } = body
        const planToUse = body.newPlan || body.plan
        
        console.log(`Action: ${action}, Plan: ${planToUse}, User: ${targetUserId || email}, Partner: ${partnerId}`);

        let resData = { success: true }

        if (action === 'create') {
            const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { name }
            })
            if (authError) throw authError

            // Vincular ao Parceiro se fornecido
            await supabaseAdmin.from('profiles').update({ 
                name, 
                role: 'USER',
                partner_id: partnerId || null 
            }).eq('id', authUser.user.id)

            if (planToUse && planToUse !== 'SEM_PLANO') {
                await supabaseAdmin.from('access_passes').insert({
                    user_id: authUser.user.id,
                    status: 'ACTIVE',
                    plan: planToUse,
                    granted_by_admin: true
                })
                await supabaseAdmin.from('profiles').update({ plan: planToUse }).eq('id', authUser.user.id)
            }
            resData = { ...resData, user: authUser.user }
        }

        else if (action === 'update-plan') {
            if (planToUse === 'SEM_PLANO' || !planToUse) {
                await supabaseAdmin.from('access_passes').update({ status: 'REVOKED' }).eq('user_id', targetUserId).eq('status', 'ACTIVE')
                await supabaseAdmin.from('profiles').update({ plan: null }).eq('id', targetUserId)
            } else {
                const { data: currentPass } = await supabaseAdmin.from('access_passes').select('id').eq('user_id', targetUserId).eq('status', 'ACTIVE').maybeSingle()
                
                if (currentPass) {
                    await supabaseAdmin.from('access_passes').update({ plan: planToUse }).eq('id', currentPass.id)
                } else {
                    await supabaseAdmin.from('access_passes').insert({
                        user_id: targetUserId,
                        status: 'ACTIVE',
                        plan: planToUse,
                        granted_by_admin: true
                    })
                }
                await supabaseAdmin.from('profiles').update({ plan: planToUse }).eq('id', targetUserId)
            }
        }

        else if (action === 'delete') {
            const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(targetUserId)
            if (authErr) throw authErr
        }

        else if (action === 'reset-password') {
            const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password })
            if (resetError) throw resetError
        }

        return new Response(JSON.stringify(resData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error(`Edge Function Error: ${error.message}`)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
