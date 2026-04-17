import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("LOG: Motor v2.3 carregado (Full Diagnostics).");

Deno.serve(async (req: Request) => {
    // 1. CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        console.log("--- INÍCIO DE PROCESSAMENTO (v2.3) ---");

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // 2. Diagnóstico de Autenticação
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            console.error("ERRO: Header Authorization não enviado pelo cliente.");
            throw new Error("Não autorizado: Sem cabeçalho Authorization.");
        }

        console.log(`DEBUG: Auth Header detectado (tamanho: ${authHeader.length})`);
        const token = authHeader.replace(/^bearer\s+/i, '');

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.error("ERRO AUTH SUPABASE:", authError?.message || "Usuário não encontrado");
            return new Response(JSON.stringify({
                error: 'Sessão inválida. Por favor, faça login novamente no site.',
                details: authError?.message || "User null"
            }), { status: 401, headers: corsHeaders });
        }

        console.log(`DEBUG: Autenticado como ${user.id}`);

        // 3. Parsing do Corpo
        let body;
        try {
            body = await req.json();
        } catch (e) {
            throw new Error("Corpo da requisição inválido (não é JSON).");
        }

        const { subtypeCode, userPlan, targetUserId } = body;
        console.log(`DEBUG: Solicitado [${subtypeCode}] no plano [${userPlan}] para [${targetUserId || 'self'}]`);

        if (!subtypeCode || !userPlan) {
            throw new Error(`Parâmetros incompletos. Recebido: ${JSON.stringify(body)}`);
        }

        let finalUserId = user.id;
        if (targetUserId && targetUserId !== user.id) {
            console.log(`DEBUG: Verificando permissão para ${user.id} gerar relatório de ${targetUserId}`);
            
            const { data: requesterProfile, error: reqError } = await supabase
                .from('profiles')
                .select('role, id')
                .eq('id', user.id)
                .single();

            if (reqError || !requesterProfile) {
                console.error("ERRO AUTH: Perfil do solicitante não encontrado no banco.");
                return new Response(JSON.stringify({ error: "Acesso negado: Perfil do solicitante não encontrado." }), { status: 403, headers: corsHeaders });
            }

            const role = (requesterProfile.role || '').toUpperCase();
            console.log(`DEBUG: Role do solicitante: ${role}`);

            if (role === 'ADMIN') {
                finalUserId = targetUserId;
                console.log(`LOG: Admin ${user.id} autorizado para ${targetUserId}`);
            } else if (role === 'PARTNER') {
                // Verificar se o usuário pertence a este parceiro
                const { data: targetProfile, error: targetError } = await supabase
                    .from('profiles')
                    .select('partner_id')
                    .eq('id', targetUserId)
                    .single();
                
                if (targetError || !targetProfile) {
                    console.error(`ERRO: Falha ao buscar perfil do alvo ${targetUserId}`);
                    return new Response(JSON.stringify({ error: "Erro ao validar vínculo: Perfil do alvo não encontrado." }), { status: 403, headers: corsHeaders });
                }

                if (targetProfile.partner_id !== requesterProfile.id) {
                    console.error(`NEGADO: Parceiro ${user.id} tentou acessar usuário ${targetUserId} vinculado ao parceiro ${targetProfile.partner_id}`);
                    return new Response(JSON.stringify({ error: `Acesso negado: Este cliente pertence a outro parceiro ou é independente.` }), { status: 403, headers: corsHeaders });
                }

                finalUserId = targetUserId;
                console.log(`LOG: Parceiro ${user.id} autorizado para seu cliente ${targetUserId}`);
            } else {
                console.error(`NEGADO: Usuário comum ${user.id} tentou gerar para ${targetUserId}`);
                return new Response(JSON.stringify({ error: "Acesso negado: Permissão insuficiente para gerar relatórios de terceiros." }), { status: 403, headers: corsHeaders });
            }
        }

        // 4. Busca do Relatório no Banco
        const { data: asset, error: assetError } = await supabase
            .from('report_assets')
            .select('*')
            .eq('subtype', subtypeCode)
            .eq('plan', userPlan)
            .single();

        if (assetError || !asset) {
            console.error("ERRO BANCO:", assetError?.message);
            throw new Error(`Nenhum relatório configurado para ${subtypeCode} (${userPlan}).`);
        }

        // Caso PDF Estático
        if (asset.asset_type === 'PDF') {
            console.log("DEBUG: Retornando PDF estático.");
            return new Response(JSON.stringify({ url: asset.file_url }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 5. Download e Conversão via Railway
        const { data: docxData, error: downloadError } = await supabase.storage
            .from('report-templates')
            .download(asset.file_path);

        if (downloadError) throw new Error(`Falha ao baixar template: ${downloadError.message}`);

        const { data: profile, error: profileError } = await supabase.from('profiles').select('name').eq('id', finalUserId).single();
        
        if (profileError || !profile) {
            console.error(`ERRO PERFIL: Falha ao buscar perfil para ${finalUserId}: ${profileError?.message || 'Não encontrado'}`);
        }

        // Força o nome do perfil se existir, senão usa 'Usuário'
        const fullName = (profile?.name || '').trim() || 'Usuário';
        console.log(`LOG v2.5: Identificado para ID=${finalUserId}, Nome="${fullName}"`);
        
        // Log extra para conferir se 'Usuário' está vindo de uma falha de banco
        if (fullName === 'Usuário') {
            console.warn(`AVISO: O nome para o ID ${finalUserId} retornou 'Usuário'. Verifique se este ID existe na tabela 'profiles'.`);
        }

        // Lógica de Primeiro Nome (com suporte a compostos comuns no Brasil)
        const nameParts = fullName.split(/\s+/).filter(p => p.length > 0);
        let firstName = nameParts[0] || 'Usuário';
        
        const compositePrefixes = ['ana', 'maria', 'joão', 'joao', 'josé', 'jose', 'luiz', 'luis', 'pedro', 'paulo', 'carlos', 'antonio', 'antônio', 'marcos', 'victor', 'vitor'];
        
        if (nameParts.length > 1 && compositePrefixes.includes(nameParts[0].toLowerCase())) {
            firstName = `${nameParts[0]} ${nameParts[1]}`;
        }

        // 5.5 Geração da Data Atual (pt-BR)
        const currentDate = new Date().toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        const converterUrl = Deno.env.get('INTERNAL_CONVERTER_URL');
        const converterToken = Deno.env.get('INTERNAL_CONVERTER_TOKEN');

        console.log(`DEBUG: Enviando ao conversor. fullName="${fullName}", firstName="${firstName}", data="${currentDate}"`);
        const formData = new FormData();
        const docxBuffer = await docxData.arrayBuffer();
        
        // Detectar extensão real do template para o conversor identificar (odt ou docx)
        const assetExt = asset.file_path.split('.').pop() || 'docx';
        formData.append('file', new Blob([docxBuffer]), `template.${assetExt}`);
        
        formData.append('fullName', fullName);
        formData.append('firstName', firstName);
        formData.append('currentDate', currentDate);

        const convResponse = await fetch(`${converterUrl}/convert`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${converterToken}` },
            body: formData
        });

        if (!convResponse.ok) {
            const errText = await convResponse.text();
            throw new Error(`Conversor Railway falhou: ${errText}`);
        }

        const pdfBlob = await convResponse.blob();

        // 6. Nome Personalizado do Arquivo
        const planDisplay = userPlan === 'OURO' ? 'Ouro' : 'Básica';
        
        // Mapeamento de Tipos
        const typeMap: Record<string, string> = {
            'T1': 'Perfeccionista',
            'T2': 'Ajudador',
            'T3': 'Realizador',
            'T4': 'Emocional',
            'T5': 'Analítico',
            'T6': 'Questionador',
            'T7': 'Entusiasta',
            'T8': 'Dominador',
            'T9': 'Mediador'
        };

        const baseTypeCode = subtypeCode.substring(0, 2); // Ex: T9A -> T9
        let typeDisplay = typeMap[baseTypeCode] || subtypeCode;
        
        // Se for plano Ouro e tiver subtitulo (Subtipo), podemos tentar usar o nome do arquétipo se enviado
        if (userPlan === 'OURO' && body.archetypeTitle) {
            typeDisplay = body.archetypeTitle;
        }

        const safeUsername = fullName.replace(/[<>:"/\\|?*]/g, ''); // Limpar caracteres inválidos para Windows
        const customFileName = `PMAC® ${planDisplay} - ${typeDisplay} - ${safeUsername}.pdf`;

        // 7. Upload e Link Final
        const finalPath = `generated/${finalUserId}/${subtypeCode}_${userPlan}_${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage.from('report-files').upload(finalPath, pdfBlob, {
            contentType: 'application/pdf',
            upsert: true
        });

        if (uploadError) throw new Error(`Erro ao salvar PDF: ${uploadError.message}`);

        const { data: signedData, error: signedError } = await supabase.storage.from('report-files').createSignedUrl(finalPath, 3600, {
            download: customFileName
        });
        if (signedError) throw new Error(`Erro ao criar URL: ${signedError.message}`);

        console.log(`--- SUCESSO TOTAL: ${customFileName} ---`);
        return new Response(JSON.stringify({ url: signedData.signedUrl, fileName: customFileName }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error("FALHA v2.3:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
