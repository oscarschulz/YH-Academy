(function () {
    const STORAGE_KEY = 'yh_lang';
    const DEFAULT_LANG = 'en';
    const SUPPORTED_LANGS = ['en', 'zh', 'hi', 'es', 'ar', 'fr', 'pt', 'ru'];

    const resources = {
        en: {
            translation: {
                pages: {
                    applyTitle: 'YH Universe',
                    dashboardTitle: 'Dashboard | YH Universe'
                },
                common: {
                    notification: 'Notification',
                    language: 'Language'
                },
                apply: {
                    brand: 'Young Hustlers Universe',
                    topEnter: 'Enter Universe ➔',
                    heroPill: 'Global structured network',
                    heroTitle: 'Young Hustlers Universe',
                    heroNarrative: 'This is not just a community. This is a system for direction, structure, and expansion.',
                    heroSubtitle: 'One universe. Multiple divisions. Build your roadmap, enter the Academy, and prepare for the rise of the Plazas and the Federation.',
                    heroPrimary: 'Access The Academy ➔',
                    heroNote: 'Start your roadmap in under 60 seconds',
                    heroSecondary: 'Explore Divisions',
                    proof1: '✔ Structured growth system',
                    proof2: '✔ Live execution environment',
                    proof3: '✔ Expansion-ready universe',
                    liveNow: 'Live now',
                    comingSoon: 'Coming soon',
                    scrollHint: 'Scroll to explore',
                    previewKicker: 'Universe Preview',
                    previewStrong: 'Roadmaps. Community. Live execution.',
                    sectionDivisionsKicker: 'Universe Divisions',
                    sectionDivisionsTitle: 'Everything inside the dashboard, introduced on one page',
                    sectionDivisionsCopy: 'The dashboard is structured into live execution, upcoming monetization systems, and future strategic expansion.',
                    academyCardTitle: 'YH Academy',
                    academyCardCopy: 'Build your roadmap through AI-guided missions, enter the community, track execution, and step into live sessions.',
                    academyFeat1: 'AI roadmap generation',
                    academyFeat2: 'Mission and execution system',
                    academyFeat3: 'Community feed and comments',
                    academyFeat4: 'Live division entry',
                    academyBtn: 'Enter YH Academy ➔',
                    plazasCardTitle: 'The Plazas',
                    plazasCardCopy: 'The marketplace layer of the universe. Skills, services, offers, talent, and monetization pathways will live here.',
                    plazasFeat1: 'Marketplace and services',
                    plazasFeat2: 'Talent and offers',
                    plazasFeat3: 'Patron-led monetization',
                    plazasFeat4: 'Expansion-ready infrastructure',
                    federationCardTitle: 'The Federation',
                    federationCardCopy: 'The strategic network layer. High-value contacts, global leverage, and long-term relationship capital will be managed here.',
                    federationFeat1: 'High-value network directory',
                    federationFeat2: 'Strategic relationship mapping',
                    federationFeat3: 'Global leverage layer',
                    federationFeat4: 'Elite expansion system',
                    dashboardHighlightsKicker: 'Dashboard Highlights',
                    dashboardHighlightsTitle: 'What users will unlock inside the universe',
                    preview1Title: 'Universe Hub',
                    preview1Copy: 'Move across divisions from one command layer.',
                    preview2Title: 'Academy Roadmaps',
                    preview2Copy: 'AI-built execution plans based on goals, blockers, and seriousness.',
                    preview3Title: 'Community Layer',
                    preview3Copy: 'Post updates, engage, comment, and build momentum with others.',
                    preview4Title: 'Future Expansion',
                    preview4Copy: 'Plazas and Federation are already positioned as the next layers.'
                },
                auth: {
                    emailAddress: 'Email Address',
                    password: 'Password',
                    forgotPassword: 'Forgot password?',
                    login: 'Login',
                    backToLogin: '⬅ Back to Login',
                    fullName: 'Full Name',
                    email: 'Email',
                    username: 'Username',
                    createPassword: 'Create Password',
                    confirmPassword: 'Confirm Password',
                    createAccount: 'Create Account ➔',
                    verifyIdentity: 'Verify Your Identity',
                    verifyEnter: 'Verify & Enter Universe ➔',
                    resendCode: 'Resend Code',
                    resetPassword: 'Reset Password',
                    cancelBack: 'Cancel & Back to Login',
                    sendRecoveryCode: 'Send Recovery Code',
                    verifyResetCode: 'Verify Reset Code',
                    verifyCode: 'Verify Code',
                    createNewPassword: 'Create New Password',
                    newPassword: 'New Password',
                    confirmNewPassword: 'Confirm New Password',
                    saveNewPassword: 'Save New Password ➔',
                    passwordChanged: 'Password Changed!',
                    passwordChangedCopy: 'Your password has been successfully updated.',
                    backLoginCta: 'Back to Login ➔',
                    egName: 'e.g. John Doe',
                    egEmail: 'you@email.com',
                    chooseUsername: 'Choose a username',
                    choosePhoto: 'Choose profile photo',
                    show: 'Show',
                    hide: 'Hide',
                    loading: 'Loading...',
                    creatingAccount: 'Creating Account...',
                    sending: 'Sending...',
                    verifying: 'Verifying...',
                    saving: 'Saving...',
                    resendIn: 'Resend in {{time}}'
                },
                dashboard: {
                    logout: '⎋ Log out',
                    notifications: 'Notifications',
                    markAllRead: 'Mark all as read',
                    noNotifications: 'No notifications yet.',
                    resourcesDesktop: 'Partnerships and Resources',
                    resourcesMobile: 'Featured sites',
                    quickAccess: 'Quick Access',
                    universeKicker: 'YH Universe Navigator',
                    universeTitle: 'YH UNIVERSE',
                    liveDivision: 'Live Division',
                    academyMeta: 'Roadmaps, execution, community, live sessions',
                    academyTitle: 'The Academy',
                    academyDesc: 'Enter the self-improvement division of YH Universe. Build your roadmap through AI-guided missions, join the community, and step into live voice sessions.',
                    academyBtn: 'Apply for the Academy ➔',
                    chatWelcomeTopic: 'Welcome to The Academy Universe',
                    chatPlaceholderCommunity: 'Message 💬 {{room}}.',
                    chatTopicGroup: 'Private Brainstorming Group',
                    chatTopicDm: 'Direct Message',
                    chatPlaceholderRoom: 'Message {{room}}.',
                    missionUpdateTitle: 'Update Mission',
                    missionUpdateContext: 'Add a short note before updating this mission.',
                    missionNote: 'Note',
                    missionNotePlaceholder: 'Write a short note...',
                    missionSaveUpdate: 'Save Update',
                    missionSkipTitle: 'Skip Mission',
                    missionSkipContext: 'Why are you skipping "{{title}}" today?',
                    missionSkipFallback: 'this mission',
                    missionSkipLabel: 'Reason for skipping',
                    missionSkipPlaceholder: 'Why are you skipping this mission right now?',
                    missionSkipBtn: 'Mark as Skipped',
                    missionStuckTitle: 'Mark Mission as Stuck',
                    missionStuckContext: 'What exactly is blocking progress on "{{title}}"?',
                    missionStuckLabel: 'What are you stuck on?',
                    missionStuckPlaceholder: 'Describe the blocker clearly...',
                    missionStuckBtn: 'Mark as Stuck',
                    saving: 'Saving...',
                    saveCheckin: 'Save Check-In',
                    roadmapCreating: 'Creating Roadmap...',
                    roadmapSubmit: 'Submit Roadmap Request ➔',
                    openAcademy: 'Open YH Academy ➔',
                    academyDirectory: 'Academy Directory',
                    otherHustlers: 'Check out other Hustlers',
                    otherHustlersCopy: 'Browse members from the database and follow them from here.',
                    loadingMembers: 'Loading members...',
                    stateApproved: 'Academy Access Approved',
                    stateWaitlisted: 'Your Academy application is waitlisted',
                    stateReviewed: 'Your Academy application has been reviewed',
                    stateLocked: 'Locked',
                    stateUnlocked: 'Unlocked',
                    statePending: 'Pending Review',
                    stateApply: 'Apply for Access'
                },

                'Please choose an image file.': 'Please choose an image file.',
                'Please enter your email/username and password.': 'Please enter your email/username and password.',
                'Server error during login.': 'Server error during login.',
                'Passwords do not match.': 'Passwords do not match.',
                'Please enter a username.': 'Please enter a username.',
                'Profile photo is required.': 'Profile photo is required.',
                'Please upload a valid image file.': 'Please upload a valid image file.',
                'Missing verification email. Please register again.': 'Missing verification email. Please register again.',
                'A new code has been sent to your email.': 'A new code has been sent to your email.',
                'Failed to resend code.': 'Failed to resend code.',
                'Account verified. Welcome to YH Universe.': 'Account verified. Welcome to YH Universe.',
                'Server error during verification.': 'Server error during verification.',
                'Server error.': 'Server error.',
                '{{division}} is coming soon to Young Hustlers Universe.': '{{division}} is coming soon to Young Hustlers Universe.',
                'Registration successful! Check your email for the verification code.': 'Registration successful! Check your email for the verification code.',
                'Email is already registered.': 'Email is already registered.',
                'Invalid verification code.': 'Invalid verification code.',
                'Email verified successfully!': 'Email verified successfully!',
                'User not found.': 'User not found.',
                'Account is already verified.': 'Account is already verified.',
                'Invalid email/username or password.': 'Invalid email/username or password.',
                'Account not verified. Please check your email and enter your OTP code first.': 'Account not verified. Please check your email and enter your OTP code first.',
                'Login successful!': 'Login successful!',
                'Logged out successfully.': 'Logged out successfully.',
                'Email not found in our system.': 'Email not found in our system.',
                'Password reset code sent to your email.': 'Password reset code sent to your email.',
                'Invalid or expired reset code.': 'Invalid or expired reset code.',
                'Code verified! You can now create a new password.': 'Code verified! You can now create a new password.',
                'Password successfully reset!': 'Password successfully reset!',

                'Choose a room first.': 'Choose a room first.',
                'All notifications marked as read.': 'All notifications marked as read.',
                'Your session expired. Please log in again.': 'Your session expired. Please log in again.',
                'Refreshing roadmap...': 'Refreshing roadmap...',
                'Roadmap refreshed.': 'Roadmap refreshed.',
                'Mission action is missing required data.': 'Mission action is missing required data.',
                'Please add a short note before continuing.': 'Please add a short note before continuing.',
                'Please complete the required check-in fields.': 'Please complete the required check-in fields.',
                'Check-in saved.': 'Check-in saved.',
                'Check-in failed.': 'Check-in failed.',
                'Your AI roadmap is ready.': 'Your AI roadmap is ready.',
                'Academy approved. You can now enter.': 'Academy approved. You can now enter.',
                'Your Academy application is now waitlisted.': 'Your Academy application is now waitlisted.',
                'Your Academy application has been reviewed.': 'Your Academy application has been reviewed.',
                'Academy membership approved. Opening Community Feed.': 'Academy membership approved. Opening Community Feed.',
                'Your Academy application is already under review.': 'Your Academy application is already under review.',
                'Your Academy application is waitlisted. Contact admin for the next step.': 'Your Academy application is waitlisted. Contact admin for the next step.',
                'Your Academy application has already been reviewed. Only admin can reopen it.': 'Your Academy application has already been reviewed. Only admin can reopen it.',
                'You already filled the Academy application. Please wait for admin review.': 'You already filled the Academy application. Please wait for admin review.',
                'Failed to load Academy home.': 'Failed to load Academy home.'
            }
        },

        es: {
            translation: {
                pages: {
                    applyTitle: 'YH Universe',
                    dashboardTitle: 'Panel | YH Universe'
                },
                common: {
                    notification: 'Notificación',
                    language: 'Idioma'
                },
                apply: {
                    brand: 'Young Hustlers Universe',
                    topEnter: 'Entrar al Universo ➔',
                    heroPill: 'Red estructurada global',
                    heroTitle: 'Young Hustlers Universe',
                    heroNarrative: 'Esto no es solo una comunidad. Es un sistema de dirección, estructura y expansión.',
                    heroSubtitle: 'Un universo. Múltiples divisiones. Construye tu hoja de ruta, entra a la Academia y prepárate para el auge de las Plazas y la Federación.',
                    heroPrimary: 'Acceder a la Academia ➔',
                    heroNote: 'Comienza tu hoja de ruta en menos de 60 segundos',
                    heroSecondary: 'Explorar divisiones',
                    proof1: '✔ Sistema de crecimiento estructurado',
                    proof2: '✔ Entorno de ejecución en vivo',
                    proof3: '✔ Universo listo para expandirse',
                    liveNow: 'Activo ahora',
                    comingSoon: 'Muy pronto',
                    scrollHint: 'Desliza para explorar',
                    previewKicker: 'Vista previa del universo',
                    previewStrong: 'Hojas de ruta. Comunidad. Ejecución en vivo.',
                    sectionDivisionsKicker: 'Divisiones del universo',
                    sectionDivisionsTitle: 'Todo lo que hay dentro del panel, presentado en una sola página',
                    sectionDivisionsCopy: 'El panel está estructurado en ejecución activa, próximos sistemas de monetización y futura expansión estratégica.',
                    academyCardTitle: 'YH Academy',
                    academyCardCopy: 'Construye tu hoja de ruta con misiones guiadas por IA, entra en la comunidad, sigue tu ejecución y participa en sesiones en vivo.',
                    academyFeat1: 'Generación de hoja de ruta con IA',
                    academyFeat2: 'Sistema de misiones y ejecución',
                    academyFeat3: 'Feed comunitario y comentarios',
                    academyFeat4: 'Entrada a división en vivo',
                    academyBtn: 'Entrar a YH Academy ➔',
                    plazasCardTitle: 'Las Plazas',
                    plazasCardCopy: 'La capa de mercado del universo. Aquí vivirán habilidades, servicios, ofertas, talento y rutas de monetización.',
                    plazasFeat1: 'Mercado y servicios',
                    plazasFeat2: 'Talento y ofertas',
                    plazasFeat3: 'Monetización guiada por Patron',
                    plazasFeat4: 'Infraestructura lista para expansión',
                    federationCardTitle: 'La Federación',
                    federationCardCopy: 'La capa de red estratégica. Aquí se gestionarán contactos de alto valor, apalancamiento global y capital relacional a largo plazo.',
                    federationFeat1: 'Directorio de red de alto valor',
                    federationFeat2: 'Mapeo estratégico de relaciones',
                    federationFeat3: 'Capa de apalancamiento global',
                    federationFeat4: 'Sistema de expansión élite',
                    dashboardHighlightsKicker: 'Destacados del panel',
                    dashboardHighlightsTitle: 'Lo que los usuarios desbloquearán dentro del universo',
                    preview1Title: 'Centro del Universo',
                    preview1Copy: 'Muévete entre divisiones desde una sola capa de mando.',
                    preview2Title: 'Hojas de ruta de la Academia',
                    preview2Copy: 'Planes de ejecución creados por IA según objetivos, bloqueos y seriedad.',
                    preview3Title: 'Capa comunitaria',
                    preview3Copy: 'Publica avances, interactúa, comenta y gana impulso con otros.',
                    preview4Title: 'Expansión futura',
                    preview4Copy: 'Plazas y Federación ya están posicionadas como las siguientes capas.'
                },
                auth: {
                    emailAddress: 'Correo electrónico',
                    password: 'Contraseña',
                    forgotPassword: '¿Olvidaste tu contraseña?',
                    login: 'Iniciar sesión',
                    backToLogin: '⬅ Volver al inicio de sesión',
                    fullName: 'Nombre completo',
                    email: 'Correo',
                    username: 'Nombre de usuario',
                    createPassword: 'Crear contraseña',
                    confirmPassword: 'Confirmar contraseña',
                    createAccount: 'Crear cuenta ➔',
                    verifyIdentity: 'Verifica tu identidad',
                    verifyEnter: 'Verificar y entrar al universo ➔',
                    resendCode: 'Reenviar código',
                    resetPassword: 'Restablecer contraseña',
                    cancelBack: 'Cancelar y volver al inicio',
                    sendRecoveryCode: 'Enviar código de recuperación',
                    verifyResetCode: 'Verificar código de recuperación',
                    verifyCode: 'Verificar código',
                    createNewPassword: 'Crear nueva contraseña',
                    newPassword: 'Nueva contraseña',
                    confirmNewPassword: 'Confirmar nueva contraseña',
                    saveNewPassword: 'Guardar nueva contraseña ➔',
                    passwordChanged: '¡Contraseña cambiada!',
                    passwordChangedCopy: 'Tu contraseña se actualizó correctamente.',
                    backLoginCta: 'Volver al inicio ➔',
                    egName: 'ej. John Doe',
                    egEmail: 'tu@email.com',
                    chooseUsername: 'Elige un nombre de usuario',
                    choosePhoto: 'Elegir foto de perfil',
                    show: 'Mostrar',
                    hide: 'Ocultar',
                    loading: 'Cargando...',
                    creatingAccount: 'Creando cuenta...',
                    sending: 'Enviando...',
                    verifying: 'Verificando...',
                    saving: 'Guardando...',
                    resendIn: 'Reenviar en {{time}}'
                },
                dashboard: {
                    logout: '⎋ Cerrar sesión',
                    notifications: 'Notificaciones',
                    markAllRead: 'Marcar todo como leído',
                    noNotifications: 'Aún no hay notificaciones.',
                    resourcesDesktop: 'Alianzas y recursos',
                    resourcesMobile: 'Sitios destacados',
                    quickAccess: 'Acceso rápido',
                    universeKicker: 'Navegador de YH Universe',
                    universeTitle: 'YH UNIVERSE',
                    liveDivision: 'División activa',
                    academyMeta: 'Hojas de ruta, ejecución, comunidad, sesiones en vivo',
                    academyTitle: 'La Academia',
                    academyDesc: 'Entra en la división de auto-mejora de YH Universe. Construye tu hoja de ruta con misiones guiadas por IA, únete a la comunidad y entra a sesiones de voz en vivo.',
                    academyBtn: 'Aplicar a la Academia ➔',
                    chatWelcomeTopic: 'Bienvenido al Universo de la Academia',
                    chatPlaceholderCommunity: 'Mensaje 💬 {{room}}.',
                    chatTopicGroup: 'Grupo privado de brainstorming',
                    chatTopicDm: 'Mensaje directo',
                    chatPlaceholderRoom: 'Mensaje {{room}}.',
                    missionUpdateTitle: 'Actualizar misión',
                    missionUpdateContext: 'Añade una nota corta antes de actualizar esta misión.',
                    missionNote: 'Nota',
                    missionNotePlaceholder: 'Escribe una nota corta...',
                    missionSaveUpdate: 'Guardar actualización',
                    missionSkipTitle: 'Saltar misión',
                    missionSkipContext: '¿Por qué estás saltando "{{title}}" hoy?',
                    missionSkipFallback: 'esta misión',
                    missionSkipLabel: 'Motivo para saltarla',
                    missionSkipPlaceholder: '¿Por qué estás saltando esta misión ahora mismo?',
                    missionSkipBtn: 'Marcar como saltada',
                    missionStuckTitle: 'Marcar misión como bloqueada',
                    missionStuckContext: '¿Qué está bloqueando exactamente el progreso en "{{title}}"?',
                    missionStuckLabel: '¿En qué estás bloqueado?',
                    missionStuckPlaceholder: 'Describe claramente el bloqueo...',
                    missionStuckBtn: 'Marcar como bloqueada',
                    saving: 'Guardando...',
                    saveCheckin: 'Guardar check-in',
                    roadmapCreating: 'Creando hoja de ruta...',
                    roadmapSubmit: 'Enviar solicitud de hoja de ruta ➔',
                    openAcademy: 'Abrir YH Academy ➔',
                    academyDirectory: 'Directorio de la Academia',
                    otherHustlers: 'Mira a otros Hustlers',
                    otherHustlersCopy: 'Explora miembros de la base de datos y síguelos desde aquí.',
                    loadingMembers: 'Cargando miembros...',
                    stateApproved: 'Acceso a la Academia aprobado',
                    stateWaitlisted: 'Tu solicitud de Academia está en lista de espera',
                    stateReviewed: 'Tu solicitud de Academia ha sido revisada',
                    stateLocked: 'Bloqueado',
                    stateUnlocked: 'Desbloqueado',
                    statePending: 'Pendiente de revisión',
                    stateApply: 'Solicitar acceso'
                },

                'Please choose an image file.': 'Por favor, elige un archivo de imagen.',
                'Please enter your email/username and password.': 'Por favor, introduce tu correo o usuario y tu contraseña.',
                'Server error during login.': 'Error del servidor durante el inicio de sesión.',
                'Passwords do not match.': 'Las contraseñas no coinciden.',
                'Please enter a username.': 'Por favor, introduce un nombre de usuario.',
                'Profile photo is required.': 'La foto de perfil es obligatoria.',
                'Please upload a valid image file.': 'Por favor, sube un archivo de imagen válido.',
                'Missing verification email. Please register again.': 'Falta el correo de verificación. Regístrate de nuevo.',
                'A new code has been sent to your email.': 'Se ha enviado un nuevo código a tu correo.',
                'Failed to resend code.': 'No se pudo reenviar el código.',
                'Account verified. Welcome to YH Universe.': 'Cuenta verificada. Bienvenido a YH Universe.',
                'Server error during verification.': 'Error del servidor durante la verificación.',
                'Server error.': 'Error del servidor.',
                '{{division}} is coming soon to Young Hustlers Universe.': '{{division}} llegará muy pronto a Young Hustlers Universe.',
                'Registration successful! Check your email for the verification code.': '¡Registro exitoso! Revisa tu correo para el código de verificación.',
                'Email is already registered.': 'Ese correo ya está registrado.',
                'Invalid verification code.': 'Código de verificación inválido.',
                'Email verified successfully!': '¡Correo verificado con éxito!',
                'User not found.': 'Usuario no encontrado.',
                'Account is already verified.': 'La cuenta ya está verificada.',
                'Invalid email/username or password.': 'Correo, usuario o contraseña inválidos.',
                'Account not verified. Please check your email and enter your OTP code first.': 'La cuenta no está verificada. Revisa tu correo e introduce primero tu código OTP.',
                'Login successful!': '¡Inicio de sesión exitoso!',
                'Logged out successfully.': 'Sesión cerrada correctamente.',
                'Email not found in our system.': 'No encontramos ese correo en nuestro sistema.',
                'Password reset code sent to your email.': 'Se envió un código de restablecimiento a tu correo.',
                'Invalid or expired reset code.': 'El código de restablecimiento es inválido o expiró.',
                'Code verified! You can now create a new password.': '¡Código verificado! Ya puedes crear una nueva contraseña.',
                'Password successfully reset!': '¡Contraseña restablecida con éxito!',
                'Choose a room first.': 'Primero elige una sala.',
                'All notifications marked as read.': 'Todas las notificaciones se marcaron como leídas.',
                'Your session expired. Please log in again.': 'Tu sesión expiró. Inicia sesión de nuevo.',
                'Refreshing roadmap...': 'Actualizando hoja de ruta...',
                'Roadmap refreshed.': 'Hoja de ruta actualizada.',
                'Mission action is missing required data.': 'A la acción de la misión le faltan datos requeridos.',
                'Please add a short note before continuing.': 'Agrega una nota corta antes de continuar.',
                'Please complete the required check-in fields.': 'Completa los campos obligatorios del check-in.',
                'Check-in saved.': 'Check-in guardado.',
                'Check-in failed.': 'Falló el check-in.',
                'Your AI roadmap is ready.': 'Tu hoja de ruta con IA está lista.',
                'Academy approved. You can now enter.': 'Academia aprobada. Ya puedes entrar.',
                'Your Academy application is now waitlisted.': 'Tu solicitud de Academia está ahora en lista de espera.',
                'Your Academy application has been reviewed.': 'Tu solicitud de Academia ha sido revisada.',
                'Academy membership approved. Opening Community Feed.': 'Membresía de Academia aprobada. Abriendo Community Feed.',
                'Your Academy application is already under review.': 'Tu solicitud de Academia ya está en revisión.',
                'Your Academy application is waitlisted. Contact admin for the next step.': 'Tu solicitud de Academia está en lista de espera. Contacta al admin para el siguiente paso.',
                'Your Academy application has already been reviewed. Only admin can reopen it.': 'Tu solicitud de Academia ya fue revisada. Solo el admin puede reabrirla.',
                'You already filled the Academy application. Please wait for admin review.': 'Ya completaste la solicitud de Academia. Espera la revisión del admin.',
                'Failed to load Academy home.': 'No se pudo cargar Academy home.'
            }
        },
    };
const mergeTranslations = (base, override) => {
    const output = Array.isArray(base) ? [...base] : { ...base };

    Object.keys(override || {}).forEach((key) => {
        const baseValue = output[key];
        const overrideValue = override[key];

        if (
            baseValue &&
            overrideValue &&
            typeof baseValue === 'object' &&
            typeof overrideValue === 'object' &&
            !Array.isArray(baseValue) &&
            !Array.isArray(overrideValue)
        ) {
            output[key] = mergeTranslations(baseValue, overrideValue);
        } else {
            output[key] = overrideValue;
        }
    });

    return output;
};

const localizedResources = {
    zh: {
        translation: {
            pages: {
                dashboardTitle: '仪表板 | YH Universe'
            },
            common: {
                notification: '通知',
                language: '语言'
            },
            apply: {
                topEnter: '进入宇宙 ➔',
                heroPill: '全球化结构网络',
                heroNarrative: '这不仅仅是一个社区。这是一个关于方向、结构和扩张的系统。',
                heroSubtitle: '一个宇宙。多个分支。建立你的路线图，进入学院，并为 Plazas 与 Federation 的崛起做好准备。',
                heroPrimary: '进入学院 ➔',
                heroNote: '不到 60 秒开始你的路线图',
                heroSecondary: '探索各大分支',
                proof1: '✔ 结构化成长系统',
                proof2: '✔ 实时执行环境',
                proof3: '✔ 可扩展宇宙',
                liveNow: '现已开放',
                comingSoon: '即将推出',
                scrollHint: '向下滚动探索',
                previewKicker: '宇宙预览',
                previewStrong: '路线图、社区、实时执行。',
                sectionDivisionsKicker: '宇宙分支',
                sectionDivisionsTitle: '仪表板中的一切，都集中展示在这一页',
                sectionDivisionsCopy: '仪表板围绕实时执行、即将上线的变现系统和未来战略扩张而构建。',
                academyCardCopy: '通过 AI 引导任务建立你的路线图，进入社区，跟踪执行，并参与实时会话。',
                academyFeat1: 'AI 路线图生成',
                academyFeat2: '任务与执行系统',
                academyFeat3: '社区动态与评论',
                academyFeat4: '实时分支入口',
                academyBtn: '进入 YH Academy ➔',
                plazasCardTitle: 'The Plazas',
                plazasCardCopy: '宇宙中的市场层。技能、服务、报价、人才和变现路径都会在这里运作。',
                plazasFeat1: '市场与服务',
                plazasFeat2: '人才与报价',
                plazasFeat3: 'Patron 引导变现',
                plazasFeat4: '可扩展基础设施',
                federationCardTitle: 'The Federation',
                federationCardCopy: '战略网络层。高价值联系、全球杠杆和长期关系资本都会在这里管理。',
                federationFeat1: '高价值人脉目录',
                federationFeat2: '战略关系映射',
                federationFeat3: '全球杠杆层',
                federationFeat4: '精英扩张系统',
                dashboardHighlightsKicker: '仪表板亮点',
                dashboardHighlightsTitle: '用户在宇宙中将解锁的内容',
                preview1Title: '宇宙中枢',
                preview1Copy: '从一个指挥层切换不同分支。',
                preview2Title: '学院路线图',
                preview2Copy: '基于目标、障碍和认真程度生成的 AI 执行计划。',
                preview3Title: '社区层',
                preview3Copy: '发布更新、互动、评论，并与他人一起建立势能。',
                preview4Title: '未来扩张',
                preview4Copy: 'Plazas 和 Federation 已经被定位为下一层。'
            },
            auth: {
                emailAddress: '邮箱地址',
                password: '密码',
                forgotPassword: '忘记密码？',
                login: '登录',
                backToLogin: '⬅ 返回登录',
                fullName: '全名',
                email: '邮箱',
                username: '用户名',
                createPassword: '创建密码',
                confirmPassword: '确认密码',
                createAccount: '创建账户 ➔',
                verifyIdentity: '验证你的身份',
                verifyEnter: '验证并进入宇宙 ➔',
                resendCode: '重新发送验证码',
                resetPassword: '重置密码',
                cancelBack: '取消并返回登录',
                sendRecoveryCode: '发送恢复码',
                verifyResetCode: '验证重置码',
                verifyCode: '验证代码',
                createNewPassword: '创建新密码',
                newPassword: '新密码',
                confirmNewPassword: '确认新密码',
                saveNewPassword: '保存新密码 ➔',
                passwordChanged: '密码已更改！',
                passwordChangedCopy: '你的密码已成功更新。',
                backLoginCta: '返回登录 ➔',
                egName: '例如：John Doe',
                egEmail: 'you@email.com',
                chooseUsername: '选择用户名',
                choosePhoto: '选择头像',
                show: '显示',
                hide: '隐藏',
                loading: '加载中...',
                creatingAccount: '正在创建账户...',
                sending: '发送中...',
                verifying: '验证中...',
                saving: '保存中...',
                resendIn: '{{time}} 后重发'
            },
            dashboard: {
                logout: '⎋ 退出登录',
                notifications: '通知',
                markAllRead: '全部标记为已读',
                noNotifications: '暂无通知。',
                resourcesDesktop: '合作与资源',
                resourcesMobile: '精选站点',
                quickAccess: '快捷入口',
                universeKicker: 'YH Universe 导航器',
                universeTitle: 'YH UNIVERSE',
                academyMeta: '路线图、执行、社区、实时会话',
                academyTitle: '学院',
                academyDesc: '进入 YH Universe 的自我提升分支。通过 AI 引导任务建立路线图，加入社区，并参与实时语音会话。',
                academyBtn: '申请加入学院 ➔',
                chatWelcomeTopic: '欢迎来到学院宇宙',
                chatPlaceholderCommunity: '发送消息到 💬 {{room}}。',
                chatTopicGroup: '私人头脑风暴小组',
                chatTopicDm: '私信',
                chatPlaceholderRoom: '发送消息到 {{room}}。',
                missionUpdateTitle: '更新任务',
                missionUpdateContext: '在更新此任务前先添加简短备注。',
                missionNote: '备注',
                missionNotePlaceholder: '写下简短备注...',
                missionSaveUpdate: '保存更新',
                missionSkipTitle: '跳过任务',
                missionSkipContext: '你今天为什么要跳过 “{{title}}”？',
                missionSkipFallback: '这个任务',
                missionSkipLabel: '跳过原因',
                missionSkipPlaceholder: '你为什么现在要跳过这个任务？',
                missionSkipBtn: '标记为已跳过',
                missionStuckTitle: '将任务标记为卡住',
                missionStuckContext: '究竟是什么阻碍了 “{{title}}” 的进展？',
                missionStuckLabel: '你卡在哪一步？',
                missionStuckPlaceholder: '清楚描述阻碍...',
                missionStuckBtn: '标记为卡住',
                saving: '保存中...',
                saveCheckin: '保存签到',
                roadmapCreating: '正在创建路线图...',
                roadmapSubmit: '提交路线图申请 ➔',
                openAcademy: '打开 YH Academy ➔',
                academyDirectory: '学院目录',
                otherHustlers: '查看其他 Hustlers',
                otherHustlersCopy: '浏览数据库中的成员并在这里关注他们。',
                loadingMembers: '正在加载成员...',
                stateApproved: '学院访问已批准',
                stateWaitlisted: '你的学院申请已进入候补名单',
                stateReviewed: '你的学院申请已被审核',
                stateLocked: '已锁定',
                stateUnlocked: '已解锁',
                statePending: '等待审核',
                stateApply: '申请访问'
            },

            'Please choose an image file.': '请选择图片文件。',
            'Please enter your email/username and password.': '请输入你的邮箱/用户名和密码。',
            'Server error during login.': '登录时发生服务器错误。',
            'Passwords do not match.': '两次输入的密码不一致。',
            'Please enter a username.': '请输入用户名。',
            'Profile photo is required.': '必须上传头像。',
            'Please upload a valid image file.': '请上传有效的图片文件。',
            'Missing verification email. Please register again.': '缺少验证邮箱，请重新注册。',
            'A new code has been sent to your email.': '新的验证码已发送到你的邮箱。',
            'Failed to resend code.': '重新发送验证码失败。',
            'Account verified. Welcome to YH Universe.': '账户验证成功，欢迎来到 YH Universe。',
            'Server error during verification.': '验证时发生服务器错误。',
            'Server error.': '服务器错误。',
            '{{division}} is coming soon to Young Hustlers Universe.': '{{division}} 即将在 Young Hustlers Universe 上线。',
            'Registration successful! Check your email for the verification code.': '注册成功！请查看邮箱获取验证码。',
            'Email is already registered.': '该邮箱已被注册。',
            'Invalid verification code.': '验证码无效。',
            'Email verified successfully!': '邮箱验证成功！',
            'User not found.': '未找到用户。',
            'Account is already verified.': '账户已经验证。',
            'Invalid email/username or password.': '邮箱/用户名或密码无效。',
            'Account not verified. Please check your email and enter your OTP code first.': '账户未验证，请先查看邮箱并输入 OTP 验证码。',
            'Login successful!': '登录成功！',
            'Logged out successfully.': '退出成功。',
            'Email not found in our system.': '系统中未找到该邮箱。',
            'Password reset code sent to your email.': '密码重置验证码已发送到你的邮箱。',
            'Invalid or expired reset code.': '重置验证码无效或已过期。',
            'Code verified! You can now create a new password.': '验证码验证成功！现在可以设置新密码。',
            'Password successfully reset!': '密码重置成功！',
            'Choose a room first.': '请先选择一个房间。',
            'All notifications marked as read.': '所有通知已标记为已读。',
            'Your session expired. Please log in again.': '会话已过期，请重新登录。',
            'Refreshing roadmap...': '正在刷新路线图...',
            'Roadmap refreshed.': '路线图已刷新。',
            'Mission action is missing required data.': '任务操作缺少必要数据。',
            'Please add a short note before continuing.': '请先添加简短备注后再继续。',
            'Please complete the required check-in fields.': '请完成必要的签到字段。',
            'Check-in saved.': '签到已保存。',
            'Check-in failed.': '签到失败。',
            'Your AI roadmap is ready.': '你的 AI 路线图已准备好。',
            'Academy approved. You can now enter.': '学院申请已批准，你现在可以进入。',
            'Your Academy application is now waitlisted.': '你的学院申请已进入候补名单。',
            'Your Academy application has been reviewed.': '你的学院申请已被审核。',
            'Academy membership approved. Opening Community Feed.': '学院成员资格已批准，正在打开 Community Feed。',
            'Your Academy application is already under review.': '你的学院申请已在审核中。',
            'Your Academy application is waitlisted. Contact admin for the next step.': '你的学院申请已在候补名单中。请联系管理员获取下一步。',
            'Your Academy application has already been reviewed. Only admin can reopen it.': '你的学院申请已经审核，只有管理员可以重新开启。',
            'You already filled the Academy application. Please wait for admin review.': '你已经填写过学院申请，请等待管理员审核。',
            'Failed to load Academy home.': '加载 Academy home 失败。',

            'Featured Website': '精选网站',
            'Premium Resource': '高级资源',
            'Relationship and premium-network platform.': '关系与高端网络平台。',
            'Creative platform inside the wider ecosystem.': '生态系统中的创意平台。',
            'Recommended external premium method.': '推荐的外部高级方法。',
            'External protocol resource.': '外部协议资源。',
            'Coming Soon': '即将推出',
            'Academy Features': '学院功能',
            'Roadmap execution layer': '路线图执行层',
            'Build a daily plan, track progress, and use the community plus voice lounge to stay in motion.': '建立每日计划、跟踪进度，并通过社区和语音空间持续推进。',
            'Daily roadmap': '每日路线图',
            'Community feed': '社区动态',
            'What proof can you give that you are serious and not just curious?': '你能提供什么证明，说明你是认真的而不只是好奇？',
            'Mention current discipline, work ethic, routines, past effort, or anything that proves seriousness.': '请说明你当前的纪律、工作态度、日常习惯、过去的努力，或任何能证明你认真的内容。',
            'What are you willing to sacrifice or change to grow inside the Academy?': '为了在学院中成长，你愿意牺牲或改变什么？',
            'What habits, distractions, excuses, or comforts are you ready to cut off?': '你准备切断哪些习惯、分心、借口或舒适区？',
            'How serious are you about being accepted?': '你有多认真地想被录取？',
            'Select status.': '选择状态。',
            'Very Serious': '非常认真',
            'Serious but need structure': '很认真，但需要结构',
            'Looking to learn': '希望学习',
            'Just Curious': '只是好奇',
            'How many hours per week will you commit if accepted?': '如果被录取，你每周愿意投入多少小时？',
            'Select hours.': '选择小时数。',
            'Less than 3': '少于 3 小时',
            '3-5': '3-5 小时',
            '6-10': '6-10 小时',
            '10+': '10 小时以上',
            'What is the one trait or standard that makes you a good fit for The Academy?': '哪一种特质或标准让你适合进入学院？',
            'Discipline, hunger, consistency, obedience, resilience, execution, etc.': '纪律、渴望、一致性、服从、韧性、执行力等。',
            'Anything else the admin should know before reviewing your application?': '在审核你的申请前，还有什么管理员应该知道的吗？',
            'Optional extra context for the admin review.': '给管理员审核的可选补充说明。',
            'Submit Academy Application ➔': '提交学院申请 ➔',
            'Submitting your application for review.': '正在提交你的申请以供审核。',
            'Your Academy application is being prepared and queued for manual admin approval.': '你的学院申请正在准备中，并已排队等待管理员手动批准。',
            'Focus Mode Activated: Distractions Hidden': '专注模式已开启：干扰已隐藏',
            'Focus Mode Deactivated': '专注模式已关闭',
            '🔴 Exit Focus Mode': '🔴 退出专注模式',
            '👁️ Focus Mode': '👁️ 专注模式',
            'You have already voted!': '你已经投过票了！',
            'Vote cast successfully!': '投票成功！',
            '1,249 Votes': '1,249 票',
            'Just now': '刚刚',
            'Image too large. Max 2MB allowed.': '图片过大，最大允许 2MB。',
            'Display name cannot be empty.': '显示名称不能为空。',
            'Profile settings saved!': '资料设置已保存！',
            'Private Chat opened successfully!': '私人聊天已成功打开！',
            'Please fill out both subject and description.': '请填写主题和描述。',
            'Submitting.': '提交中。',
            'Submit Ticket ➔': '提交工单 ➔',
            'Ticket successfully sent to support@younghustlers.net': '工单已成功发送至 support@younghustlers.net'
        }
    },

    hi: {
        translation: {
            pages: {
                dashboardTitle: 'डैशबोर्ड | YH Universe'
            },
            common: {
                notification: 'सूचना',
                language: 'भाषा'
            },
            apply: {
                topEnter: 'यूनिवर्स में प्रवेश करें ➔',
                heroPill: 'वैश्विक संरचित नेटवर्क',
                heroNarrative: 'यह सिर्फ एक कम्युनिटी नहीं है। यह दिशा, संरचना और विस्तार की एक प्रणाली है।',
                heroSubtitle: 'एक यूनिवर्स। कई डिवीज़न। अपना रोडमैप बनाओ, अकादमी में प्रवेश करो, और Plazas तथा Federation के उदय के लिए तैयार रहो।',
                heroPrimary: 'अकादमी में प्रवेश करें ➔',
                heroNote: '60 सेकंड से कम में अपना रोडमैप शुरू करें',
                heroSecondary: 'डिवीज़न देखें',
                proof1: '✔ संरचित विकास प्रणाली',
                proof2: '✔ लाइव execution environment',
                proof3: '✔ विस्तार के लिए तैयार यूनिवर्स',
                liveNow: 'अभी लाइव',
                comingSoon: 'जल्द आ रहा है',
                scrollHint: 'एक्सप्लोर करने के लिए स्क्रॉल करें',
                previewKicker: 'यूनिवर्स प्रीव्यू',
                previewStrong: 'रोडमैप। कम्युनिटी। लाइव execution.',
                sectionDivisionsKicker: 'यूनिवर्स डिवीज़न',
                sectionDivisionsTitle: 'डैशबोर्ड के अंदर की हर चीज़, एक ही पेज पर',
                sectionDivisionsCopy: 'डैशबोर्ड लाइव execution, आने वाले monetization systems और future strategic expansion के लिए structured है।',
                academyCardCopy: 'AI-guided missions के साथ अपना रोडमैप बनाओ, कम्युनिटी में प्रवेश करो, execution track करो, और live sessions में शामिल हो।',
                academyFeat1: 'AI रोडमैप जनरेशन',
                academyFeat2: 'मिशन और execution system',
                academyFeat3: 'कम्युनिटी फीड और कमेंट्स',
                academyFeat4: 'लाइव division entry',
                academyBtn: 'YH Academy में प्रवेश करें ➔',
                plazasCardCopy: 'यूनिवर्स का marketplace layer। skills, services, offers, talent और monetization pathways यहाँ होंगे।',
                plazasFeat1: 'मार्केटप्लेस और सेवाएँ',
                plazasFeat2: 'टैलेंट और ऑफ़र्स',
                plazasFeat3: 'Patron-led monetization',
                plazasFeat4: 'expansion-ready infrastructure',
                federationCardCopy: 'strategic network layer। high-value contacts, global leverage और long-term relationship capital यहाँ manage होंगे।',
                federationFeat1: 'high-value network directory',
                federationFeat2: 'strategic relationship mapping',
                federationFeat3: 'global leverage layer',
                federationFeat4: 'elite expansion system',
                dashboardHighlightsKicker: 'डैशबोर्ड हाइलाइट्स',
                dashboardHighlightsTitle: 'यूज़र्स यूनिवर्स के अंदर क्या unlock करेंगे',
                preview1Title: 'यूनिवर्स हब',
                preview1Copy: 'एक ही command layer से अलग-अलग divisions में जाएँ।',
                preview2Title: 'Academy रोडमैप्स',
                preview2Copy: 'goals, blockers और seriousness पर आधारित AI-built execution plans.',
                preview3Title: 'कम्युनिटी लेयर',
                preview3Copy: 'अपडेट पोस्ट करो, engage करो, comment करो, और दूसरों के साथ momentum बनाओ।',
                preview4Title: 'future expansion',
                preview4Copy: 'Plazas और Federation पहले से ही अगली layers के रूप में positioned हैं।'
            },
            auth: {
                emailAddress: 'ईमेल पता',
                password: 'पासवर्ड',
                forgotPassword: 'पासवर्ड भूल गए?',
                login: 'लॉगिन',
                backToLogin: '⬅ लॉगिन पर वापस जाएँ',
                fullName: 'पूरा नाम',
                email: 'ईमेल',
                username: 'यूज़रनेम',
                createPassword: 'पासवर्ड बनाएं',
                confirmPassword: 'पासवर्ड की पुष्टि करें',
                createAccount: 'अकाउंट बनाएं ➔',
                verifyIdentity: 'अपनी पहचान सत्यापित करें',
                verifyEnter: 'सत्यापित करें और यूनिवर्स में प्रवेश करें ➔',
                resendCode: 'कोड फिर भेजें',
                resetPassword: 'पासवर्ड रीसेट करें',
                cancelBack: 'रद्द करें और लॉगिन पर लौटें',
                sendRecoveryCode: 'रिकवरी कोड भेजें',
                verifyResetCode: 'रीसेट कोड सत्यापित करें',
                verifyCode: 'कोड सत्यापित करें',
                createNewPassword: 'नया पासवर्ड बनाएं',
                newPassword: 'नया पासवर्ड',
                confirmNewPassword: 'नए पासवर्ड की पुष्टि करें',
                saveNewPassword: 'नया पासवर्ड सेव करें ➔',
                passwordChanged: 'पासवर्ड बदल गया!',
                passwordChangedCopy: 'आपका पासवर्ड सफलतापूर्वक अपडेट हो गया है।',
                backLoginCta: 'लॉगिन पर वापस जाएँ ➔',
                egName: 'उदाहरण: John Doe',
                egEmail: 'you@email.com',
                chooseUsername: 'यूज़रनेम चुनें',
                choosePhoto: 'प्रोफ़ाइल फोटो चुनें',
                show: 'दिखाएँ',
                hide: 'छिपाएँ',
                loading: 'लोड हो रहा है...',
                creatingAccount: 'अकाउंट बनाया जा रहा है...',
                sending: 'भेजा जा रहा है...',
                verifying: 'सत्यापित किया जा रहा है...',
                saving: 'सेव किया जा रहा है...',
                resendIn: '{{time}} में दोबारा भेजें'
            },
            dashboard: {
                logout: '⎋ लॉग आउट',
                notifications: 'सूचनाएँ',
                markAllRead: 'सभी को पढ़ा हुआ चिह्नित करें',
                noNotifications: 'अभी कोई सूचना नहीं है।',
                resourcesDesktop: 'पार्टनरशिप्स और रिसोर्सेज',
                resourcesMobile: 'फीचर्ड साइट्स',
                quickAccess: 'क्विक एक्सेस',
                universeKicker: 'YH Universe नेविगेटर',
                academyMeta: 'रोडमैप्स, execution, community, live sessions',
                academyTitle: 'Academy',
                academyDesc: 'YH Universe के self-improvement division में प्रवेश करें। AI-guided missions के साथ अपना roadmap बनाएं, community join करें, और live voice sessions में जाएँ।',
                academyBtn: 'Academy के लिए apply करें ➔',
                chatWelcomeTopic: 'Academy Universe में आपका स्वागत है',
                chatPlaceholderCommunity: '💬 {{room}} में संदेश भेजें।',
                chatTopicGroup: 'Private Brainstorming Group',
                chatTopicDm: 'Direct Message',
                chatPlaceholderRoom: '{{room}} में संदेश भेजें।',
                missionUpdateTitle: 'मिशन अपडेट करें',
                missionUpdateContext: 'इस मिशन को अपडेट करने से पहले एक छोटा नोट जोड़ें।',
                missionNote: 'नोट',
                missionNotePlaceholder: 'एक छोटा नोट लिखें...',
                missionSaveUpdate: 'अपडेट सेव करें',
                missionSkipTitle: 'मिशन छोड़ें',
                missionSkipContext: 'आज आप "{{title}}" क्यों छोड़ रहे हैं?',
                missionSkipFallback: 'यह मिशन',
                missionSkipLabel: 'छोड़ने का कारण',
                missionSkipPlaceholder: 'आप यह मिशन अभी क्यों छोड़ रहे हैं?',
                missionSkipBtn: 'Skipped के रूप में चिह्नित करें',
                missionStuckTitle: 'मिशन को Stuck के रूप में चिह्नित करें',
                missionStuckContext: '"{{title}}" की progress को वास्तव में क्या रोक रहा है?',
                missionStuckLabel: 'आप कहाँ अटके हुए हैं?',
                missionStuckPlaceholder: 'blocker को स्पष्ट रूप से बताइए...',
                missionStuckBtn: 'Stuck के रूप में चिह्नित करें',
                saving: 'सेव किया जा रहा है...',
                saveCheckin: 'चेक-इन सेव करें',
                roadmapCreating: 'रोडमैप बनाया जा रहा है...',
                roadmapSubmit: 'रोडमैप अनुरोध जमा करें ➔',
                openAcademy: 'YH Academy खोलें ➔',
                academyDirectory: 'Academy Directory',
                otherHustlers: 'अन्य Hustlers देखें',
                otherHustlersCopy: 'डेटाबेस से members देखें और उन्हें यहाँ से follow करें।',
                loadingMembers: 'मेंबर्स लोड हो रहे हैं...',
                stateApproved: 'Academy Access स्वीकृत',
                stateWaitlisted: 'आपकी Academy application waitlisted है',
                stateReviewed: 'आपकी Academy application की समीक्षा हो चुकी है',
                stateLocked: 'लॉक्ड',
                stateUnlocked: 'अनलॉक्ड',
                statePending: 'समीक्षा लंबित',
                stateApply: 'एक्सेस के लिए आवेदन करें'
            },

            'Please choose an image file.': 'कृपया एक इमेज फ़ाइल चुनें।',
            'Please enter your email/username and password.': 'कृपया अपना ईमेल/यूज़रनेम और पासवर्ड दर्ज करें।',
            'Server error during login.': 'लॉगिन के दौरान सर्वर त्रुटि हुई।',
            'Passwords do not match.': 'पासवर्ड मेल नहीं खाते।',
            'Please enter a username.': 'कृपया यूज़रनेम दर्ज करें।',
            'Profile photo is required.': 'प्रोफ़ाइल फोटो आवश्यक है।',
            'Please upload a valid image file.': 'कृपया एक वैध इमेज फ़ाइल अपलोड करें।',
            'Missing verification email. Please register again.': 'वेरिफिकेशन ईमेल नहीं मिला। कृपया फिर से रजिस्टर करें।',
            'A new code has been sent to your email.': 'एक नया कोड आपके ईमेल पर भेज दिया गया है।',
            'Failed to resend code.': 'कोड दोबारा भेजने में विफल।',
            'Account verified. Welcome to YH Universe.': 'अकाउंट सत्यापित हो गया। YH Universe में आपका स्वागत है।',
            'Server error during verification.': 'वेरिफिकेशन के दौरान सर्वर त्रुटि हुई।',
            'Server error.': 'सर्वर त्रुटि।',
            '{{division}} is coming soon to Young Hustlers Universe.': '{{division}} जल्द ही Young Hustlers Universe में आ रहा है।',
            'Registration successful! Check your email for the verification code.': 'रजिस्ट्रेशन सफल रहा! वेरिफिकेशन कोड के लिए अपना ईमेल देखें।',
            'Email is already registered.': 'यह ईमेल पहले से रजिस्टर्ड है।',
            'Invalid verification code.': 'अमान्य वेरिफिकेशन कोड।',
            'Email verified successfully!': 'ईमेल सफलतापूर्वक सत्यापित हो गया!',
            'User not found.': 'यूज़र नहीं मिला।',
            'Account is already verified.': 'अकाउंट पहले से सत्यापित है।',
            'Invalid email/username or password.': 'ईमेल/यूज़रनेम या पासवर्ड अमान्य है।',
            'Account not verified. Please check your email and enter your OTP code first.': 'अकाउंट सत्यापित नहीं है। कृपया पहले ईमेल देखें और OTP कोड दर्ज करें।',
            'Login successful!': 'लॉगिन सफल रहा!',
            'Logged out successfully.': 'सफलतापूर्वक लॉग आउट किया गया।',
            'Email not found in our system.': 'हमारे सिस्टम में यह ईमेल नहीं मिला।',
            'Password reset code sent to your email.': 'पासवर्ड रीसेट कोड आपके ईमेल पर भेजा गया है।',
            'Invalid or expired reset code.': 'रीसेट कोड अमान्य है या समाप्त हो चुका है।',
            'Code verified! You can now create a new password.': 'कोड सत्यापित हो गया! अब आप नया पासवर्ड बना सकते हैं।',
            'Password successfully reset!': 'पासवर्ड सफलतापूर्वक रीसेट हुआ!',
            'Choose a room first.': 'पहले एक रूम चुनें।',
            'All notifications marked as read.': 'सभी सूचनाएँ पढ़ी हुई चिह्नित कर दी गईं।',
            'Your session expired. Please log in again.': 'आपका सेशन समाप्त हो गया। कृपया फिर से लॉगिन करें।',
            'Refreshing roadmap...': 'रोडमैप रीफ्रेश किया जा रहा है...',
            'Roadmap refreshed.': 'रोडमैप रीफ्रेश हो गया।',
            'Mission action is missing required data.': 'मिशन action में आवश्यक डेटा नहीं है।',
            'Please add a short note before continuing.': 'आगे बढ़ने से पहले एक छोटा नोट जोड़ें।',
            'Please complete the required check-in fields.': 'कृपया आवश्यक check-in fields पूरी करें।',
            'Check-in saved.': 'Check-in सेव हो गया।',
            'Check-in failed.': 'Check-in असफल रहा।',
            'Your AI roadmap is ready.': 'आपका AI रोडमैप तैयार है।',
            'Academy approved. You can now enter.': 'Academy स्वीकृत हो गई। अब आप प्रवेश कर सकते हैं।',
            'Your Academy application is now waitlisted.': 'आपकी Academy application अब waitlisted है।',
            'Your Academy application has been reviewed.': 'आपकी Academy application की समीक्षा हो चुकी है।',
            'Academy membership approved. Opening Community Feed.': 'Academy membership स्वीकृत हो गई। Community Feed खोला जा रहा है।',
            'Your Academy application is already under review.': 'आपकी Academy application पहले से review में है।',
            'Your Academy application is waitlisted. Contact admin for the next step.': 'आपकी Academy application waitlisted है। अगले चरण के लिए admin से संपर्क करें।',
            'Your Academy application has already been reviewed. Only admin can reopen it.': 'आपकी Academy application की समीक्षा हो चुकी है। केवल admin इसे फिर से खोल सकता है।',
            'You already filled the Academy application. Please wait for admin review.': 'आप पहले ही Academy application भर चुके हैं। कृपया admin review का इंतज़ार करें।',
            'Failed to load Academy home.': 'Academy home लोड करने में विफल।'
        }
    },

    ar: {
        translation: {
            pages: {
                dashboardTitle: 'لوحة التحكم | YH Universe'
            },
            common: {
                notification: 'إشعار',
                language: 'اللغة'
            },
            apply: {
                topEnter: 'ادخل إلى الكون ➔',
                heroPill: 'شبكة عالمية منظمة',
                heroNarrative: 'هذا ليس مجرد مجتمع. إنه نظام للاتجاه والبنية والتوسع.',
                heroSubtitle: 'كون واحد. عدة أقسام. ابنِ خارطة طريقك، وادخل الأكاديمية، واستعد لصعود Plazas و Federation.',
                heroPrimary: 'ادخل إلى الأكاديمية ➔',
                heroNote: 'ابدأ خارطة طريقك في أقل من 60 ثانية',
                heroSecondary: 'استكشف الأقسام',
                proof1: '✔ نظام نمو منظم',
                proof2: '✔ بيئة تنفيذ حية',
                proof3: '✔ كون جاهز للتوسع',
                liveNow: 'متاح الآن',
                comingSoon: 'قريباً',
                scrollHint: 'مرّر للاستكشاف',
                previewKicker: 'معاينة الكون',
                previewStrong: 'خرائط طريق. مجتمع. تنفيذ حي.',
                sectionDivisionsKicker: 'أقسام الكون',
                sectionDivisionsTitle: 'كل ما بداخل لوحة التحكم، معروض في صفحة واحدة',
                sectionDivisionsCopy: 'تم تنظيم لوحة التحكم حول التنفيذ الحي وأنظمة تحقيق الدخل القادمة والتوسع الاستراتيجي المستقبلي.',
                academyCardCopy: 'ابنِ خارطة طريقك عبر مهام موجهة بالذكاء الاصطناعي، وادخل المجتمع، وتتبع التنفيذ، وانضم إلى الجلسات الحية.',
                academyFeat1: 'إنشاء خارطة طريق بالذكاء الاصطناعي',
                academyFeat2: 'نظام المهام والتنفيذ',
                academyFeat3: 'منشورات المجتمع والتعليقات',
                academyFeat4: 'دخول القسم الحي',
                academyBtn: 'ادخل إلى YH Academy ➔',
                plazasCardCopy: 'الطبقة السوقية داخل الكون. المهارات والخدمات والعروض والمواهب ومسارات تحقيق الدخل ستوجد هنا.',
                plazasFeat1: 'السوق والخدمات',
                plazasFeat2: 'المواهب والعروض',
                plazasFeat3: 'تحقيق دخل بقيادة Patron',
                plazasFeat4: 'بنية جاهزة للتوسع',
                federationCardCopy: 'طبقة الشبكة الاستراتيجية. سيتم هنا إدارة العلاقات عالية القيمة والرافعة العالمية ورأس المال العلاقي طويل الأجل.',
                federationFeat1: 'دليل شبكة عالية القيمة',
                federationFeat2: 'رسم خرائط العلاقات الاستراتيجية',
                federationFeat3: 'طبقة الرافعة العالمية',
                federationFeat4: 'نظام التوسع النخبوي',
                dashboardHighlightsKicker: 'أبرز ما في اللوحة',
                dashboardHighlightsTitle: 'ما الذي سيفتحه المستخدمون داخل الكون',
                preview1Title: 'مركز الكون',
                preview1Copy: 'تنقل بين الأقسام من طبقة قيادة واحدة.',
                preview2Title: 'خرائط طريق الأكاديمية',
                preview2Copy: 'خطط تنفيذ مبنية بالذكاء الاصطناعي بحسب الأهداف والعوائق والجدية.',
                preview3Title: 'طبقة المجتمع',
                preview3Copy: 'انشر التحديثات وتفاعل وعلّق وابنِ زخماً مع الآخرين.',
                preview4Title: 'التوسع المستقبلي',
                preview4Copy: 'تم وضع Plazas و Federation بالفعل كطبقات قادمة.'
            },
            auth: {
                emailAddress: 'البريد الإلكتروني',
                password: 'كلمة المرور',
                forgotPassword: 'هل نسيت كلمة المرور؟',
                login: 'تسجيل الدخول',
                backToLogin: '⬅ العودة إلى تسجيل الدخول',
                fullName: 'الاسم الكامل',
                email: 'البريد الإلكتروني',
                username: 'اسم المستخدم',
                createPassword: 'إنشاء كلمة مرور',
                confirmPassword: 'تأكيد كلمة المرور',
                createAccount: 'إنشاء حساب ➔',
                verifyIdentity: 'تحقق من هويتك',
                verifyEnter: 'تحقق وادخل إلى الكون ➔',
                resendCode: 'إعادة إرسال الرمز',
                resetPassword: 'إعادة تعيين كلمة المرور',
                cancelBack: 'إلغاء والعودة إلى تسجيل الدخول',
                sendRecoveryCode: 'إرسال رمز الاستعادة',
                verifyResetCode: 'تحقق من رمز الاستعادة',
                verifyCode: 'تحقق من الرمز',
                createNewPassword: 'إنشاء كلمة مرور جديدة',
                newPassword: 'كلمة مرور جديدة',
                confirmNewPassword: 'تأكيد كلمة المرور الجديدة',
                saveNewPassword: 'حفظ كلمة المرور الجديدة ➔',
                passwordChanged: 'تم تغيير كلمة المرور!',
                passwordChangedCopy: 'تم تحديث كلمة المرور بنجاح.',
                backLoginCta: 'العودة إلى تسجيل الدخول ➔',
                egName: 'مثال: John Doe',
                egEmail: 'you@email.com',
                chooseUsername: 'اختر اسم مستخدم',
                choosePhoto: 'اختر صورة ملف شخصي',
                show: 'إظهار',
                hide: 'إخفاء',
                loading: 'جارٍ التحميل...',
                creatingAccount: 'جارٍ إنشاء الحساب...',
                sending: 'جارٍ الإرسال...',
                verifying: 'جارٍ التحقق...',
                saving: 'جارٍ الحفظ...',
                resendIn: 'إعادة الإرسال خلال {{time}}'
            },
            dashboard: {
                logout: '⎋ تسجيل الخروج',
                notifications: 'الإشعارات',
                markAllRead: 'تحديد الكل كمقروء',
                noNotifications: 'لا توجد إشعارات بعد.',
                resourcesDesktop: 'الشراكات والموارد',
                resourcesMobile: 'مواقع مميزة',
                quickAccess: 'وصول سريع',
                universeKicker: 'موجّه YH Universe',
                academyMeta: 'خرائط طريق، تنفيذ، مجتمع، جلسات حية',
                academyTitle: 'الأكاديمية',
                academyDesc: 'ادخل إلى قسم تطوير الذات في YH Universe. ابنِ خارطة طريقك عبر مهام موجهة بالذكاء الاصطناعي، وانضم إلى المجتمع، وادخل إلى الجلسات الصوتية الحية.',
                academyBtn: 'قدّم للأكاديمية ➔',
                chatWelcomeTopic: 'مرحباً بك في كون الأكاديمية',
                chatPlaceholderCommunity: 'أرسل رسالة إلى 💬 {{room}}.',
                chatTopicGroup: 'مجموعة عصف ذهني خاصة',
                chatTopicDm: 'رسالة مباشرة',
                chatPlaceholderRoom: 'أرسل رسالة إلى {{room}}.',
                missionUpdateTitle: 'تحديث المهمة',
                missionUpdateContext: 'أضف ملاحظة قصيرة قبل تحديث هذه المهمة.',
                missionNote: 'ملاحظة',
                missionNotePlaceholder: 'اكتب ملاحظة قصيرة...',
                missionSaveUpdate: 'حفظ التحديث',
                missionSkipTitle: 'تخطي المهمة',
                missionSkipContext: 'لماذا تتخطى "{{title}}" اليوم؟',
                missionSkipFallback: 'هذه المهمة',
                missionSkipLabel: 'سبب التخطي',
                missionSkipPlaceholder: 'لماذا تتخطى هذه المهمة الآن؟',
                missionSkipBtn: 'تحديد كمُتخطاة',
                missionStuckTitle: 'تحديد المهمة كعالقة',
                missionStuckContext: 'ما الذي يمنع التقدم في "{{title}}" بالضبط؟',
                missionStuckLabel: 'بماذا أنت عالق؟',
                missionStuckPlaceholder: 'اشرح العائق بوضوح...',
                missionStuckBtn: 'تحديد كعالقة',
                saving: 'جارٍ الحفظ...',
                saveCheckin: 'حفظ تسجيل الحضور',
                roadmapCreating: 'جارٍ إنشاء خارطة الطريق...',
                roadmapSubmit: 'إرسال طلب خارطة الطريق ➔',
                openAcademy: 'فتح YH Academy ➔',
                academyDirectory: 'دليل الأكاديمية',
                otherHustlers: 'اطّلع على Hustlers الآخرين',
                otherHustlersCopy: 'تصفح الأعضاء من قاعدة البيانات وتابعهم من هنا.',
                loadingMembers: 'جارٍ تحميل الأعضاء...',
                stateApproved: 'تمت الموافقة على وصول الأكاديمية',
                stateWaitlisted: 'تم وضع طلب الأكاديمية الخاص بك على قائمة الانتظار',
                stateReviewed: 'تمت مراجعة طلب الأكاديمية الخاص بك',
                stateLocked: 'مغلق',
                stateUnlocked: 'مفتوح',
                statePending: 'قيد المراجعة',
                stateApply: 'قدّم للوصول'
            },

            'Please choose an image file.': 'يرجى اختيار ملف صورة.',
            'Please enter your email/username and password.': 'يرجى إدخال البريد الإلكتروني/اسم المستخدم وكلمة المرور.',
            'Server error during login.': 'حدث خطأ في الخادم أثناء تسجيل الدخول.',
            'Passwords do not match.': 'كلمتا المرور غير متطابقتين.',
            'Please enter a username.': 'يرجى إدخال اسم المستخدم.',
            'Profile photo is required.': 'صورة الملف الشخصي مطلوبة.',
            'Please upload a valid image file.': 'يرجى رفع ملف صورة صالح.',
            'Missing verification email. Please register again.': 'البريد الإلكتروني الخاص بالتحقق مفقود. يرجى التسجيل مرة أخرى.',
            'A new code has been sent to your email.': 'تم إرسال رمز جديد إلى بريدك الإلكتروني.',
            'Failed to resend code.': 'فشل في إعادة إرسال الرمز.',
            'Account verified. Welcome to YH Universe.': 'تم التحقق من الحساب. مرحباً بك في YH Universe.',
            'Server error during verification.': 'حدث خطأ في الخادم أثناء التحقق.',
            'Server error.': 'خطأ في الخادم.',
            '{{division}} is coming soon to Young Hustlers Universe.': '{{division}} قادم قريباً إلى Young Hustlers Universe.',
            'Registration successful! Check your email for the verification code.': 'تم التسجيل بنجاح! تحقق من بريدك الإلكتروني للحصول على رمز التحقق.',
            'Email is already registered.': 'هذا البريد الإلكتروني مسجل بالفعل.',
            'Invalid verification code.': 'رمز التحقق غير صالح.',
            'Email verified successfully!': 'تم التحقق من البريد الإلكتروني بنجاح!',
            'User not found.': 'المستخدم غير موجود.',
            'Account is already verified.': 'الحساب تم التحقق منه بالفعل.',
            'Invalid email/username or password.': 'البريد الإلكتروني/اسم المستخدم أو كلمة المرور غير صحيحة.',
            'Account not verified. Please check your email and enter your OTP code first.': 'الحساب غير متحقق منه. يرجى التحقق من بريدك الإلكتروني وإدخال رمز OTP أولاً.',
            'Login successful!': 'تم تسجيل الدخول بنجاح!',
            'Logged out successfully.': 'تم تسجيل الخروج بنجاح.',
            'Email not found in our system.': 'لم يتم العثور على البريد الإلكتروني في نظامنا.',
            'Password reset code sent to your email.': 'تم إرسال رمز إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.',
            'Invalid or expired reset code.': 'رمز إعادة التعيين غير صالح أو منتهي الصلاحية.',
            'Code verified! You can now create a new password.': 'تم التحقق من الرمز! يمكنك الآن إنشاء كلمة مرور جديدة.',
            'Password successfully reset!': 'تمت إعادة تعيين كلمة المرور بنجاح!',
            'Choose a room first.': 'اختر غرفة أولاً.',
            'All notifications marked as read.': 'تم تحديد جميع الإشعارات كمقروءة.',
            'Your session expired. Please log in again.': 'انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.',
            'Refreshing roadmap...': 'جارٍ تحديث خارطة الطريق...',
            'Roadmap refreshed.': 'تم تحديث خارطة الطريق.',
            'Mission action is missing required data.': 'إجراء المهمة يفتقد بيانات مطلوبة.',
            'Please add a short note before continuing.': 'يرجى إضافة ملاحظة قصيرة قبل المتابعة.',
            'Please complete the required check-in fields.': 'يرجى إكمال حقول check-in المطلوبة.',
            'Check-in saved.': 'تم حفظ check-in.',
            'Check-in failed.': 'فشل حفظ check-in.',
            'Your AI roadmap is ready.': 'خارطة الطريق الخاصة بك بالذكاء الاصطناعي جاهزة.',
            'Academy approved. You can now enter.': 'تمت الموافقة على الأكاديمية. يمكنك الدخول الآن.',
            'Your Academy application is now waitlisted.': 'تم وضع طلب الأكاديمية الخاص بك على قائمة الانتظار الآن.',
            'Your Academy application has been reviewed.': 'تمت مراجعة طلب الأكاديمية الخاص بك.',
            'Academy membership approved. Opening Community Feed.': 'تمت الموافقة على عضوية الأكاديمية. جارٍ فتح Community Feed.',
            'Your Academy application is already under review.': 'طلب الأكاديمية الخاص بك قيد المراجعة بالفعل.',
            'Your Academy application is waitlisted. Contact admin for the next step.': 'طلب الأكاديمية الخاص بك على قائمة الانتظار. تواصل مع المسؤول للخطوة التالية.',
            'Your Academy application has already been reviewed. Only admin can reopen it.': 'تمت مراجعة طلب الأكاديمية بالفعل. المسؤول فقط يمكنه إعادة فتحه.',
            'You already filled the Academy application. Please wait for admin review.': 'لقد قمت بالفعل بملء طلب الأكاديمية. يرجى انتظار مراجعة المسؤول.',
            'Failed to load Academy home.': 'فشل تحميل Academy home.'
        }
    },

    fr: {
        translation: {
            pages: {
                dashboardTitle: 'Tableau de bord | YH Universe'
            },
            common: {
                notification: 'Notification',
                language: 'Langue'
            },
            apply: {
                topEnter: 'Entrer dans l’univers ➔',
                heroPill: 'Réseau mondial structuré',
                heroNarrative: 'Ce n’est pas seulement une communauté. C’est un système de direction, de structure et d’expansion.',
                heroSubtitle: 'Un univers. Plusieurs divisions. Construis ta feuille de route, entre dans l’Académie et prépare-toi à la montée des Plazas et de la Fédération.',
                heroPrimary: 'Accéder à l’Académie ➔',
                heroNote: 'Commence ta feuille de route en moins de 60 secondes',
                heroSecondary: 'Explorer les divisions',
                proof1: '✔ Système de croissance structuré',
                proof2: '✔ Environnement d’exécution en direct',
                proof3: '✔ Univers prêt pour l’expansion',
                liveNow: 'Disponible maintenant',
                comingSoon: 'Bientôt disponible',
                scrollHint: 'Fais défiler pour explorer',
                previewKicker: 'Aperçu de l’univers',
                previewStrong: 'Feuilles de route. Communauté. Exécution en direct.',
                sectionDivisionsKicker: 'Divisions de l’univers',
                sectionDivisionsTitle: 'Tout ce qui est dans le tableau de bord, présenté sur une seule page',
                sectionDivisionsCopy: 'Le tableau de bord est structuré autour de l’exécution en direct, des futurs systèmes de monétisation et de l’expansion stratégique à venir.',
                academyCardCopy: 'Construis ta feuille de route grâce à des missions guidées par l’IA, entre dans la communauté, suis ton exécution et participe aux sessions en direct.',
                academyFeat1: 'Génération de feuille de route par IA',
                academyFeat2: 'Système de missions et d’exécution',
                academyFeat3: 'Fil communautaire et commentaires',
                academyFeat4: 'Entrée de division en direct',
                academyBtn: 'Entrer dans YH Academy ➔',
                plazasCardCopy: 'La couche marketplace de l’univers. Compétences, services, offres, talents et chemins de monétisation vivront ici.',
                plazasFeat1: 'Marketplace et services',
                plazasFeat2: 'Talents et offres',
                plazasFeat3: 'Monétisation pilotée par Patron',
                plazasFeat4: 'Infrastructure prête pour l’expansion',
                federationCardCopy: 'La couche réseau stratégique. Les contacts de grande valeur, l’effet de levier mondial et le capital relationnel à long terme y seront gérés.',
                federationFeat1: 'Annuaire de réseau à haute valeur',
                federationFeat2: 'Cartographie stratégique des relations',
                federationFeat3: 'Couche de levier mondial',
                federationFeat4: 'Système d’expansion élite',
                dashboardHighlightsKicker: 'Points forts du tableau de bord',
                dashboardHighlightsTitle: 'Ce que les utilisateurs débloqueront dans l’univers',
                preview1Title: 'Hub de l’univers',
                preview1Copy: 'Passe d’une division à l’autre depuis une seule couche de commandement.',
                preview2Title: 'Feuilles de route de l’Académie',
                preview2Copy: 'Plans d’exécution générés par IA selon les objectifs, les blocages et le niveau de sérieux.',
                preview3Title: 'Couche communautaire',
                preview3Copy: 'Publie des mises à jour, interagis, commente et crée de l’élan avec les autres.',
                preview4Title: 'Expansion future',
                preview4Copy: 'Plazas et Fédération sont déjà positionnées comme les prochaines couches.'
            },
            auth: {
                emailAddress: 'Adresse e-mail',
                password: 'Mot de passe',
                forgotPassword: 'Mot de passe oublié ?',
                login: 'Connexion',
                backToLogin: '⬅ Retour à la connexion',
                fullName: 'Nom complet',
                email: 'E-mail',
                username: 'Nom d’utilisateur',
                createPassword: 'Créer un mot de passe',
                confirmPassword: 'Confirmer le mot de passe',
                createAccount: 'Créer un compte ➔',
                verifyIdentity: 'Vérifie ton identité',
                verifyEnter: 'Vérifier et entrer dans l’univers ➔',
                resendCode: 'Renvoyer le code',
                resetPassword: 'Réinitialiser le mot de passe',
                cancelBack: 'Annuler et revenir à la connexion',
                sendRecoveryCode: 'Envoyer le code de récupération',
                verifyResetCode: 'Vérifier le code de réinitialisation',
                verifyCode: 'Vérifier le code',
                createNewPassword: 'Créer un nouveau mot de passe',
                newPassword: 'Nouveau mot de passe',
                confirmNewPassword: 'Confirmer le nouveau mot de passe',
                saveNewPassword: 'Enregistrer le nouveau mot de passe ➔',
                passwordChanged: 'Mot de passe modifié !',
                passwordChangedCopy: 'Ton mot de passe a été mis à jour avec succès.',
                backLoginCta: 'Retour à la connexion ➔',
                chooseUsername: 'Choisis un nom d’utilisateur',
                choosePhoto: 'Choisir une photo de profil',
                show: 'Afficher',
                hide: 'Masquer',
                loading: 'Chargement...',
                creatingAccount: 'Création du compte...',
                sending: 'Envoi...',
                verifying: 'Vérification...',
                saving: 'Enregistrement...',
                resendIn: 'Renvoyer dans {{time}}'
            },
            dashboard: {
                logout: '⎋ Déconnexion',
                notifications: 'Notifications',
                markAllRead: 'Tout marquer comme lu',
                noNotifications: 'Aucune notification pour le moment.',
                resourcesDesktop: 'Partenariats et ressources',
                resourcesMobile: 'Sites en vedette',
                quickAccess: 'Accès rapide',
                universeKicker: 'Navigateur YH Universe',
                academyMeta: 'Feuilles de route, exécution, communauté, sessions en direct',
                academyTitle: 'L’Académie',
                academyDesc: 'Entre dans la division d’amélioration personnelle de YH Universe. Construis ta feuille de route avec des missions guidées par IA, rejoins la communauté et participe aux sessions vocales en direct.',
                academyBtn: 'Postuler à l’Académie ➔',
                chatWelcomeTopic: 'Bienvenue dans l’univers de l’Académie',
                chatPlaceholderCommunity: 'Envoyer un message à 💬 {{room}}.',
                chatTopicGroup: 'Groupe privé de brainstorming',
                chatTopicDm: 'Message direct',
                chatPlaceholderRoom: 'Envoyer un message à {{room}}.',
                missionUpdateTitle: 'Mettre à jour la mission',
                missionUpdateContext: 'Ajoute une courte note avant de mettre à jour cette mission.',
                missionNote: 'Note',
                missionNotePlaceholder: 'Écris une courte note...',
                missionSaveUpdate: 'Enregistrer la mise à jour',
                missionSkipTitle: 'Ignorer la mission',
                missionSkipContext: 'Pourquoi ignores-tu "{{title}}" aujourd’hui ?',
                missionSkipFallback: 'cette mission',
                missionSkipLabel: 'Raison de l’ignorance',
                missionSkipPlaceholder: 'Pourquoi ignores-tu cette mission maintenant ?',
                missionSkipBtn: 'Marquer comme ignorée',
                missionStuckTitle: 'Marquer la mission comme bloquée',
                missionStuckContext: 'Qu’est-ce qui bloque exactement la progression sur "{{title}}" ?',
                missionStuckLabel: 'Sur quoi es-tu bloqué ?',
                missionStuckPlaceholder: 'Décris clairement le blocage...',
                missionStuckBtn: 'Marquer comme bloquée',
                saving: 'Enregistrement...',
                saveCheckin: 'Enregistrer le check-in',
                roadmapCreating: 'Création de la feuille de route...',
                roadmapSubmit: 'Soumettre la demande de feuille de route ➔',
                openAcademy: 'Ouvrir YH Academy ➔',
                academyDirectory: 'Annuaire de l’Académie',
                otherHustlers: 'Découvre les autres Hustlers',
                otherHustlersCopy: 'Parcours les membres depuis la base de données et suis-les depuis ici.',
                loadingMembers: 'Chargement des membres...',
                stateApproved: 'Accès à l’Académie approuvé',
                stateWaitlisted: 'Ta candidature à l’Académie est sur liste d’attente',
                stateReviewed: 'Ta candidature à l’Académie a été examinée',
                stateLocked: 'Verrouillé',
                stateUnlocked: 'Déverrouillé',
                statePending: 'En attente de révision',
                stateApply: 'Demander l’accès'
            },

            'Please choose an image file.': 'Veuillez choisir un fichier image.',
            'Please enter your email/username and password.': 'Veuillez saisir votre e-mail/nom d’utilisateur et votre mot de passe.',
            'Server error during login.': 'Erreur serveur pendant la connexion.',
            'Passwords do not match.': 'Les mots de passe ne correspondent pas.',
            'Please enter a username.': 'Veuillez saisir un nom d’utilisateur.',
            'Profile photo is required.': 'La photo de profil est obligatoire.',
            'Please upload a valid image file.': 'Veuillez téléverser un fichier image valide.',
            'Missing verification email. Please register again.': 'E-mail de vérification manquant. Veuillez vous inscrire à nouveau.',
            'A new code has been sent to your email.': 'Un nouveau code a été envoyé à votre e-mail.',
            'Failed to resend code.': 'Échec du renvoi du code.',
            'Account verified. Welcome to YH Universe.': 'Compte vérifié. Bienvenue dans YH Universe.',
            'Server error during verification.': 'Erreur serveur pendant la vérification.',
            'Server error.': 'Erreur serveur.',
            '{{division}} is coming soon to Young Hustlers Universe.': '{{division}} arrive bientôt sur Young Hustlers Universe.',
            'Registration successful! Check your email for the verification code.': 'Inscription réussie ! Vérifiez votre e-mail pour le code de vérification.',
            'Email is already registered.': 'Cet e-mail est déjà enregistré.',
            'Invalid verification code.': 'Code de vérification invalide.',
            'Email verified successfully!': 'E-mail vérifié avec succès !',
            'User not found.': 'Utilisateur introuvable.',
            'Account is already verified.': 'Le compte est déjà vérifié.',
            'Invalid email/username or password.': 'E-mail/nom d’utilisateur ou mot de passe invalide.',
            'Account not verified. Please check your email and enter your OTP code first.': 'Compte non vérifié. Veuillez vérifier votre e-mail et saisir d’abord votre code OTP.',
            'Login successful!': 'Connexion réussie !',
            'Logged out successfully.': 'Déconnexion réussie.',
            'Email not found in our system.': 'E-mail introuvable dans notre système.',
            'Password reset code sent to your email.': 'Le code de réinitialisation du mot de passe a été envoyé à votre e-mail.',
            'Invalid or expired reset code.': 'Le code de réinitialisation est invalide ou expiré.',
            'Code verified! You can now create a new password.': 'Code vérifié ! Vous pouvez maintenant créer un nouveau mot de passe.',
            'Password successfully reset!': 'Mot de passe réinitialisé avec succès !',
            'Choose a room first.': 'Choisissez d’abord une salle.',
            'All notifications marked as read.': 'Toutes les notifications ont été marquées comme lues.',
            'Your session expired. Please log in again.': 'Votre session a expiré. Veuillez vous reconnecter.',
            'Refreshing roadmap...': 'Actualisation de la feuille de route...',
            'Roadmap refreshed.': 'Feuille de route actualisée.',
            'Mission action is missing required data.': 'L’action de mission manque de données requises.',
            'Please add a short note before continuing.': 'Veuillez ajouter une courte note avant de continuer.',
            'Please complete the required check-in fields.': 'Veuillez compléter les champs de check-in requis.',
            'Check-in saved.': 'Check-in enregistré.',
            'Check-in failed.': 'Échec du check-in.',
            'Your AI roadmap is ready.': 'Votre feuille de route IA est prête.',
            'Academy approved. You can now enter.': 'Académie approuvée. Vous pouvez maintenant entrer.',
            'Your Academy application is now waitlisted.': 'Votre candidature à l’Académie est maintenant sur liste d’attente.',
            'Your Academy application has been reviewed.': 'Votre candidature à l’Académie a été examinée.',
            'Academy membership approved. Opening Community Feed.': 'Adhésion à l’Académie approuvée. Ouverture du Community Feed.',
            'Your Academy application is already under review.': 'Votre candidature à l’Académie est déjà en cours d’examen.',
            'Your Academy application is waitlisted. Contact admin for the next step.': 'Votre candidature à l’Académie est sur liste d’attente. Contactez l’admin pour l’étape suivante.',
            'Your Academy application has already been reviewed. Only admin can reopen it.': 'Votre candidature à l’Académie a déjà été examinée. Seul l’admin peut la rouvrir.',
            'You already filled the Academy application. Please wait for admin review.': 'Vous avez déjà rempli la candidature à l’Académie. Veuillez attendre l’examen de l’admin.',
            'Failed to load Academy home.': 'Échec du chargement de Academy home.'
        }
    },

    pt: {
        translation: {
            pages: {
                dashboardTitle: 'Painel | YH Universe'
            },
            common: {
                notification: 'Notificação',
                language: 'Idioma'
            },
            apply: {
                topEnter: 'Entrar no Universo ➔',
                heroPill: 'Rede global estruturada',
                heroNarrative: 'Isto não é apenas uma comunidade. É um sistema de direção, estrutura e expansão.',
                heroSubtitle: 'Um universo. Múltiplas divisões. Construa seu roadmap, entre na Academia e prepare-se para a ascensão das Plazas e da Federação.',
                heroPrimary: 'Acessar a Academia ➔',
                heroNote: 'Comece seu roadmap em menos de 60 segundos',
                heroSecondary: 'Explorar divisões',
                proof1: '✔ Sistema de crescimento estruturado',
                proof2: '✔ Ambiente de execução ao vivo',
                proof3: '✔ Universo pronto para expansão',
                liveNow: 'Ao vivo agora',
                comingSoon: 'Em breve',
                scrollHint: 'Role para explorar',
                previewKicker: 'Prévia do Universo',
                previewStrong: 'Roadmaps. Comunidade. Execução ao vivo.',
                sectionDivisionsKicker: 'Divisões do Universo',
                sectionDivisionsTitle: 'Tudo o que está no painel, apresentado em uma só página',
                sectionDivisionsCopy: 'O painel é estruturado em torno de execução ao vivo, futuros sistemas de monetização e expansão estratégica futura.',
                academyCardCopy: 'Construa seu roadmap com missões guiadas por IA, entre na comunidade, acompanhe sua execução e participe de sessões ao vivo.',
                academyFeat1: 'Geração de roadmap com IA',
                academyFeat2: 'Sistema de missões e execução',
                academyFeat3: 'Feed da comunidade e comentários',
                academyFeat4: 'Entrada da divisão ao vivo',
                academyBtn: 'Entrar no YH Academy ➔',
                plazasCardCopy: 'A camada de marketplace do universo. Habilidades, serviços, ofertas, talentos e caminhos de monetização viverão aqui.',
                plazasFeat1: 'Marketplace e serviços',
                plazasFeat2: 'Talentos e ofertas',
                plazasFeat3: 'Monetização liderada por Patron',
                plazasFeat4: 'Infraestrutura pronta para expansão',
                federationCardCopy: 'A camada de rede estratégica. Contatos de alto valor, alavancagem global e capital relacional de longo prazo serão geridos aqui.',
                federationFeat1: 'Diretório de rede de alto valor',
                federationFeat2: 'Mapeamento estratégico de relacionamentos',
                federationFeat3: 'Camada de alavancagem global',
                federationFeat4: 'Sistema de expansão elite',
                dashboardHighlightsKicker: 'Destaques do Painel',
                dashboardHighlightsTitle: 'O que os usuários desbloquearão dentro do universo',
                preview1Title: 'Hub do Universo',
                preview1Copy: 'Mova-se entre divisões a partir de uma única camada de comando.',
                preview2Title: 'Roadmaps da Academia',
                preview2Copy: 'Planos de execução criados por IA com base em metas, bloqueios e seriedade.',
                preview3Title: 'Camada da comunidade',
                preview3Copy: 'Publique atualizações, interaja, comente e crie impulso com outras pessoas.',
                preview4Title: 'Expansão futura',
                preview4Copy: 'Plazas e Federação já estão posicionadas como as próximas camadas.'
            },
            auth: {
                emailAddress: 'Endereço de e-mail',
                password: 'Senha',
                forgotPassword: 'Esqueceu a senha?',
                login: 'Entrar',
                backToLogin: '⬅ Voltar ao login',
                fullName: 'Nome completo',
                email: 'E-mail',
                username: 'Nome de usuário',
                createPassword: 'Criar senha',
                confirmPassword: 'Confirmar senha',
                createAccount: 'Criar conta ➔',
                verifyIdentity: 'Verifique sua identidade',
                verifyEnter: 'Verificar e entrar no universo ➔',
                resendCode: 'Reenviar código',
                resetPassword: 'Redefinir senha',
                cancelBack: 'Cancelar e voltar ao login',
                sendRecoveryCode: 'Enviar código de recuperação',
                verifyResetCode: 'Verificar código de redefinição',
                verifyCode: 'Verificar código',
                createNewPassword: 'Criar nova senha',
                newPassword: 'Nova senha',
                confirmNewPassword: 'Confirmar nova senha',
                saveNewPassword: 'Salvar nova senha ➔',
                passwordChanged: 'Senha alterada!',
                passwordChangedCopy: 'Sua senha foi atualizada com sucesso.',
                backLoginCta: 'Voltar ao login ➔',
                chooseUsername: 'Escolha um nome de usuário',
                choosePhoto: 'Escolher foto de perfil',
                show: 'Mostrar',
                hide: 'Ocultar',
                loading: 'Carregando...',
                creatingAccount: 'Criando conta...',
                sending: 'Enviando...',
                verifying: 'Verificando...',
                saving: 'Salvando...',
                resendIn: 'Reenviar em {{time}}'
            },
            dashboard: {
                logout: '⎋ Sair',
                notifications: 'Notificações',
                markAllRead: 'Marcar tudo como lido',
                noNotifications: 'Ainda não há notificações.',
                resourcesDesktop: 'Parcerias e recursos',
                resourcesMobile: 'Sites em destaque',
                quickAccess: 'Acesso rápido',
                universeKicker: 'Navegador do YH Universe',
                academyMeta: 'Roadmaps, execução, comunidade, sessões ao vivo',
                academyTitle: 'A Academia',
                academyDesc: 'Entre na divisão de autoaperfeiçoamento do YH Universe. Construa seu roadmap com missões guiadas por IA, entre na comunidade e participe de sessões de voz ao vivo.',
                academyBtn: 'Candidatar-se à Academia ➔',
                chatWelcomeTopic: 'Bem-vindo ao Universo da Academia',
                chatPlaceholderCommunity: 'Mensagem para 💬 {{room}}.',
                chatTopicGroup: 'Grupo privado de brainstorming',
                chatTopicDm: 'Mensagem direta',
                chatPlaceholderRoom: 'Mensagem para {{room}}.',
                missionUpdateTitle: 'Atualizar missão',
                missionUpdateContext: 'Adicione uma nota curta antes de atualizar esta missão.',
                missionNote: 'Nota',
                missionNotePlaceholder: 'Escreva uma nota curta...',
                missionSaveUpdate: 'Salvar atualização',
                missionSkipTitle: 'Pular missão',
                missionSkipContext: 'Por que você está pulando "{{title}}" hoje?',
                missionSkipFallback: 'esta missão',
                missionSkipLabel: 'Motivo para pular',
                missionSkipPlaceholder: 'Por que você está pulando esta missão agora?',
                missionSkipBtn: 'Marcar como pulada',
                missionStuckTitle: 'Marcar missão como travada',
                missionStuckContext: 'O que exatamente está bloqueando o progresso em "{{title}}"?',
                missionStuckLabel: 'Em que você está travado?',
                missionStuckPlaceholder: 'Descreva claramente o bloqueio...',
                missionStuckBtn: 'Marcar como travada',
                saving: 'Salvando...',
                saveCheckin: 'Salvar check-in',
                roadmapCreating: 'Criando roadmap...',
                roadmapSubmit: 'Enviar solicitação de roadmap ➔',
                openAcademy: 'Abrir YH Academy ➔',
                academyDirectory: 'Diretório da Academia',
                otherHustlers: 'Veja outros Hustlers',
                otherHustlersCopy: 'Navegue pelos membros do banco de dados e siga-os daqui.',
                loadingMembers: 'Carregando membros...',
                stateApproved: 'Acesso à Academia aprovado',
                stateWaitlisted: 'Sua inscrição para a Academia está em lista de espera',
                stateReviewed: 'Sua inscrição para a Academia foi revisada',
                stateLocked: 'Bloqueado',
                stateUnlocked: 'Desbloqueado',
                statePending: 'Revisão pendente',
                stateApply: 'Solicitar acesso'
            },

            'Please choose an image file.': 'Escolha um arquivo de imagem.',
            'Please enter your email/username and password.': 'Insira seu e-mail/nome de usuário e senha.',
            'Server error during login.': 'Erro do servidor durante o login.',
            'Passwords do not match.': 'As senhas não coincidem.',
            'Please enter a username.': 'Insira um nome de usuário.',
            'Profile photo is required.': 'A foto de perfil é obrigatória.',
            'Please upload a valid image file.': 'Envie um arquivo de imagem válido.',
            'Missing verification email. Please register again.': 'E-mail de verificação ausente. Registre-se novamente.',
            'A new code has been sent to your email.': 'Um novo código foi enviado para seu e-mail.',
            'Failed to resend code.': 'Falha ao reenviar o código.',
            'Account verified. Welcome to YH Universe.': 'Conta verificada. Bem-vindo ao YH Universe.',
            'Server error during verification.': 'Erro do servidor durante a verificação.',
            'Server error.': 'Erro do servidor.',
            '{{division}} is coming soon to Young Hustlers Universe.': '{{division}} chegará em breve ao Young Hustlers Universe.',
            'Registration successful! Check your email for the verification code.': 'Registro bem-sucedido! Verifique seu e-mail para o código de verificação.',
            'Email is already registered.': 'Este e-mail já está registrado.',
            'Invalid verification code.': 'Código de verificação inválido.',
            'Email verified successfully!': 'E-mail verificado com sucesso!',
            'User not found.': 'Usuário não encontrado.',
            'Account is already verified.': 'A conta já está verificada.',
            'Invalid email/username or password.': 'E-mail/nome de usuário ou senha inválidos.',
            'Account not verified. Please check your email and enter your OTP code first.': 'Conta não verificada. Verifique seu e-mail e insira primeiro seu código OTP.',
            'Login successful!': 'Login realizado com sucesso!',
            'Logged out successfully.': 'Logout realizado com sucesso.',
            'Email not found in our system.': 'E-mail não encontrado em nosso sistema.',
            'Password reset code sent to your email.': 'O código de redefinição de senha foi enviado para seu e-mail.',
            'Invalid or expired reset code.': 'O código de redefinição é inválido ou expirou.',
            'Code verified! You can now create a new password.': 'Código verificado! Agora você pode criar uma nova senha.',
            'Password successfully reset!': 'Senha redefinida com sucesso!',
            'Choose a room first.': 'Escolha uma sala primeiro.',
            'All notifications marked as read.': 'Todas as notificações foram marcadas como lidas.',
            'Your session expired. Please log in again.': 'Sua sessão expirou. Faça login novamente.',
            'Refreshing roadmap...': 'Atualizando roadmap...',
            'Roadmap refreshed.': 'Roadmap atualizado.',
            'Mission action is missing required data.': 'A ação da missão está sem dados obrigatórios.',
            'Please add a short note before continuing.': 'Adicione uma nota curta antes de continuar.',
            'Please complete the required check-in fields.': 'Complete os campos obrigatórios do check-in.',
            'Check-in saved.': 'Check-in salvo.',
            'Check-in failed.': 'Falha ao salvar o check-in.',
            'Your AI roadmap is ready.': 'Seu roadmap de IA está pronto.',
            'Academy approved. You can now enter.': 'Academia aprovada. Agora você pode entrar.',
            'Your Academy application is now waitlisted.': 'Sua inscrição para a Academia agora está na lista de espera.',
            'Your Academy application has been reviewed.': 'Sua inscrição para a Academia foi revisada.',
            'Academy membership approved. Opening Community Feed.': 'Adesão à Academia aprovada. Abrindo o Community Feed.',
            'Your Academy application is already under review.': 'Sua inscrição para a Academia já está em revisão.',
            'Your Academy application is waitlisted. Contact admin for the next step.': 'Sua inscrição para a Academia está em lista de espera. Entre em contato com o admin para a próxima etapa.',
            'Your Academy application has already been reviewed. Only admin can reopen it.': 'Sua inscrição para a Academia já foi revisada. Apenas o admin pode reabri-la.',
            'You already filled the Academy application. Please wait for admin review.': 'Você já preencheu a inscrição para a Academia. Aguarde a revisão do admin.',
            'Failed to load Academy home.': 'Falha ao carregar o Academy home.'
        }
    },

    ru: {
        translation: {
            pages: {
                dashboardTitle: 'Панель | YH Universe'
            },
            common: {
                notification: 'Уведомление',
                language: 'Язык'
            },
            apply: {
                topEnter: 'Войти во вселенную ➔',
                heroPill: 'Глобальная структурированная сеть',
                heroNarrative: 'Это не просто сообщество. Это система направления, структуры и расширения.',
                heroSubtitle: 'Одна вселенная. Несколько направлений. Построй свою дорожную карту, войди в Академию и подготовься к росту Plazas и Federation.',
                heroPrimary: 'Войти в Академию ➔',
                heroNote: 'Начни свою дорожную карту менее чем за 60 секунд',
                heroSecondary: 'Изучить направления',
                proof1: '✔ Структурированная система роста',
                proof2: '✔ Среда живого исполнения',
                proof3: '✔ Вселенная, готовая к расширению',
                liveNow: 'Доступно сейчас',
                comingSoon: 'Скоро',
                scrollHint: 'Прокрути, чтобы изучить',
                previewKicker: 'Предпросмотр вселенной',
                previewStrong: 'Дорожные карты. Сообщество. Живое исполнение.',
                sectionDivisionsKicker: 'Направления вселенной',
                sectionDivisionsTitle: 'Всё внутри панели представлено на одной странице',
                sectionDivisionsCopy: 'Панель структурирована вокруг живого исполнения, будущих систем монетизации и стратегического расширения.',
                academyCardCopy: 'Строй свою дорожную карту с помощью миссий под управлением ИИ, входи в сообщество, отслеживай исполнение и присоединяйся к живым сессиям.',
                academyFeat1: 'Генерация дорожной карты с ИИ',
                academyFeat2: 'Система миссий и исполнения',
                academyFeat3: 'Лента сообщества и комментарии',
                academyFeat4: 'Вход в живое направление',
                academyBtn: 'Войти в YH Academy ➔',
                plazasCardCopy: 'Рыночный слой вселенной. Навыки, услуги, предложения, таланты и пути монетизации будут находиться здесь.',
                plazasFeat1: 'Маркетплейс и услуги',
                plazasFeat2: 'Таланты и предложения',
                plazasFeat3: 'Монетизация под руководством Patron',
                plazasFeat4: 'Инфраструктура, готовая к расширению',
                federationCardCopy: 'Стратегический сетевой слой. Здесь будут управляться ценные контакты, глобальный рычаг и долгосрочный relational capital.',
                federationFeat1: 'Каталог ценной сети',
                federationFeat2: 'Стратегическое картирование связей',
                federationFeat3: 'Слой глобального рычага',
                federationFeat4: 'Элитная система расширения',
                dashboardHighlightsKicker: 'Ключевые моменты панели',
                dashboardHighlightsTitle: 'Что пользователи откроют внутри вселенной',
                preview1Title: 'Центр вселенной',
                preview1Copy: 'Перемещайся между направлениями из единого командного слоя.',
                preview2Title: 'Дорожные карты Академии',
                preview2Copy: 'Планы исполнения, созданные ИИ на основе целей, блокеров и уровня серьёзности.',
                preview3Title: 'Слой сообщества',
                preview3Copy: 'Публикуй обновления, взаимодействуй, комментируй и создавай импульс вместе с другими.',
                preview4Title: 'Будущее расширение',
                preview4Copy: 'Plazas и Federation уже позиционированы как следующие слои.'
            },
            auth: {
                emailAddress: 'Адрес электронной почты',
                password: 'Пароль',
                forgotPassword: 'Забыли пароль?',
                login: 'Войти',
                backToLogin: '⬅ Назад ко входу',
                fullName: 'Полное имя',
                email: 'Электронная почта',
                username: 'Имя пользователя',
                createPassword: 'Создать пароль',
                confirmPassword: 'Подтвердить пароль',
                createAccount: 'Создать аккаунт ➔',
                verifyIdentity: 'Подтвердите свою личность',
                verifyEnter: 'Подтвердить и войти во вселенную ➔',
                resendCode: 'Повторно отправить код',
                resetPassword: 'Сбросить пароль',
                cancelBack: 'Отменить и вернуться ко входу',
                sendRecoveryCode: 'Отправить код восстановления',
                verifyResetCode: 'Подтвердить код сброса',
                verifyCode: 'Подтвердить код',
                createNewPassword: 'Создать новый пароль',
                newPassword: 'Новый пароль',
                confirmNewPassword: 'Подтвердить новый пароль',
                saveNewPassword: 'Сохранить новый пароль ➔',
                passwordChanged: 'Пароль изменён!',
                passwordChangedCopy: 'Ваш пароль был успешно обновлён.',
                backLoginCta: 'Назад ко входу ➔',
                chooseUsername: 'Выберите имя пользователя',
                choosePhoto: 'Выбрать фото профиля',
                show: 'Показать',
                hide: 'Скрыть',
                loading: 'Загрузка...',
                creatingAccount: 'Создание аккаунта...',
                sending: 'Отправка...',
                verifying: 'Проверка...',
                saving: 'Сохранение...',
                resendIn: 'Повторная отправка через {{time}}'
            },
            dashboard: {
                logout: '⎋ Выйти',
                notifications: 'Уведомления',
                markAllRead: 'Отметить всё как прочитанное',
                noNotifications: 'Пока нет уведомлений.',
                resourcesDesktop: 'Партнёрства и ресурсы',
                resourcesMobile: 'Избранные сайты',
                quickAccess: 'Быстрый доступ',
                universeKicker: 'Навигатор YH Universe',
                academyMeta: 'Дорожные карты, исполнение, сообщество, живые сессии',
                academyTitle: 'Академия',
                academyDesc: 'Войдите в направление саморазвития YH Universe. Постройте свою дорожную карту с помощью миссий под управлением ИИ, вступите в сообщество и подключайтесь к живым голосовым сессиям.',
                academyBtn: 'Подать заявку в Академию ➔',
                chatWelcomeTopic: 'Добро пожаловать во вселенную Академии',
                chatPlaceholderCommunity: 'Сообщение в 💬 {{room}}.',
                chatTopicGroup: 'Частная brainstorming-группа',
                chatTopicDm: 'Личное сообщение',
                chatPlaceholderRoom: 'Сообщение в {{room}}.',
                missionUpdateTitle: 'Обновить миссию',
                missionUpdateContext: 'Добавьте короткую заметку перед обновлением этой миссии.',
                missionNote: 'Заметка',
                missionNotePlaceholder: 'Напишите короткую заметку...',
                missionSaveUpdate: 'Сохранить обновление',
                missionSkipTitle: 'Пропустить миссию',
                missionSkipContext: 'Почему вы пропускаете "{{title}}" сегодня?',
                missionSkipFallback: 'эту миссию',
                missionSkipLabel: 'Причина пропуска',
                missionSkipPlaceholder: 'Почему вы пропускаете эту миссию прямо сейчас?',
                missionSkipBtn: 'Отметить как пропущенную',
                missionStuckTitle: 'Отметить миссию как застрявшую',
                missionStuckContext: 'Что именно блокирует прогресс по "{{title}}"?',
                missionStuckLabel: 'На чём вы застряли?',
                missionStuckPlaceholder: 'Чётко опишите блокер...',
                missionStuckBtn: 'Отметить как застрявшую',
                saving: 'Сохранение...',
                saveCheckin: 'Сохранить check-in',
                roadmapCreating: 'Создание дорожной карты...',
                roadmapSubmit: 'Отправить запрос на дорожную карту ➔',
                openAcademy: 'Открыть YH Academy ➔',
                academyDirectory: 'Каталог Академии',
                otherHustlers: 'Посмотрите других Hustlers',
                otherHustlersCopy: 'Просматривайте участников из базы данных и подписывайтесь на них отсюда.',
                loadingMembers: 'Загрузка участников...',
                stateApproved: 'Доступ в Академию одобрен',
                stateWaitlisted: 'Ваша заявка в Академию в листе ожидания',
                stateReviewed: 'Ваша заявка в Академию была рассмотрена',
                stateLocked: 'Заблокировано',
                stateUnlocked: 'Открыто',
                statePending: 'На рассмотрении',
                stateApply: 'Запросить доступ'
            },

            'Please choose an image file.': 'Пожалуйста, выберите файл изображения.',
            'Please enter your email/username and password.': 'Пожалуйста, введите вашу почту/имя пользователя и пароль.',
            'Server error during login.': 'Ошибка сервера во время входа.',
            'Passwords do not match.': 'Пароли не совпадают.',
            'Please enter a username.': 'Пожалуйста, введите имя пользователя.',
            'Profile photo is required.': 'Фото профиля обязательно.',
            'Please upload a valid image file.': 'Пожалуйста, загрузите корректный файл изображения.',
            'Missing verification email. Please register again.': 'Отсутствует email для подтверждения. Пожалуйста, зарегистрируйтесь снова.',
            'A new code has been sent to your email.': 'Новый код был отправлен на вашу почту.',
            'Failed to resend code.': 'Не удалось повторно отправить код.',
            'Account verified. Welcome to YH Universe.': 'Аккаунт подтверждён. Добро пожаловать в YH Universe.',
            'Server error during verification.': 'Ошибка сервера во время подтверждения.',
            'Server error.': 'Ошибка сервера.',
            '{{division}} is coming soon to Young Hustlers Universe.': '{{division}} скоро появится в Young Hustlers Universe.',
            'Registration successful! Check your email for the verification code.': 'Регистрация успешна! Проверьте почту для получения кода подтверждения.',
            'Email is already registered.': 'Этот email уже зарегистрирован.',
            'Invalid verification code.': 'Неверный код подтверждения.',
            'Email verified successfully!': 'Email успешно подтверждён!',
            'User not found.': 'Пользователь не найден.',
            'Account is already verified.': 'Аккаунт уже подтверждён.',
            'Invalid email/username or password.': 'Неверная почта/имя пользователя или пароль.',
            'Account not verified. Please check your email and enter your OTP code first.': 'Аккаунт не подтверждён. Сначала проверьте почту и введите OTP-код.',
            'Login successful!': 'Вход выполнен успешно!',
            'Logged out successfully.': 'Выход выполнен успешно.',
            'Email not found in our system.': 'Email не найден в нашей системе.',
            'Password reset code sent to your email.': 'Код сброса пароля отправлен на вашу почту.',
            'Invalid or expired reset code.': 'Код сброса недействителен или истёк.',
            'Code verified! You can now create a new password.': 'Код подтверждён! Теперь вы можете создать новый пароль.',
            'Password successfully reset!': 'Пароль успешно сброшен!',
            'Choose a room first.': 'Сначала выберите комнату.',
            'All notifications marked as read.': 'Все уведомления отмечены как прочитанные.',
            'Your session expired. Please log in again.': 'Сессия истекла. Пожалуйста, войдите снова.',
            'Refreshing roadmap...': 'Обновление дорожной карты...',
            'Roadmap refreshed.': 'Дорожная карта обновлена.',
            'Mission action is missing required data.': 'В действии миссии отсутствуют обязательные данные.',
            'Please add a short note before continuing.': 'Пожалуйста, добавьте короткую заметку перед продолжением.',
            'Please complete the required check-in fields.': 'Пожалуйста, заполните обязательные поля check-in.',
            'Check-in saved.': 'Check-in сохранён.',
            'Check-in failed.': 'Не удалось сохранить check-in.',
            'Your AI roadmap is ready.': 'Ваша AI-дорожная карта готова.',
            'Academy approved. You can now enter.': 'Академия одобрена. Теперь вы можете войти.',
            'Your Academy application is now waitlisted.': 'Ваша заявка в Академию теперь в листе ожидания.',
            'Your Academy application has been reviewed.': 'Ваша заявка в Академию была рассмотрена.',
            'Academy membership approved. Opening Community Feed.': 'Членство в Академии одобрено. Открывается Community Feed.',
            'Your Academy application is already under review.': 'Ваша заявка в Академию уже на рассмотрении.',
            'Your Academy application is waitlisted. Contact admin for the next step.': 'Ваша заявка в Академию в листе ожидания. Свяжитесь с администратором для следующего шага.',
            'Your Academy application has already been reviewed. Only admin can reopen it.': 'Ваша заявка в Академию уже рассмотрена. Только администратор может открыть её снова.',
            'You already filled the Academy application. Please wait for admin review.': 'Вы уже заполнили заявку в Академию. Пожалуйста, дождитесь проверки администратором.',
            'Failed to load Academy home.': 'Не удалось загрузить Academy home.'
        }
    }
};

    Object.keys(localizedResources).forEach((lang) => {
        resources[lang] = {
            translation: mergeTranslations(
                resources.en?.translation || {},
                localizedResources[lang]?.translation || {}
            )
        };
    });

    function getSavedLanguage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
        } catch (_) {}
        return DEFAULT_LANG;
    }
    function setText(selector, value) {
        document.querySelectorAll(selector).forEach((el) => {
            el.textContent = value;
        });
    }

    function setPlaceholder(selector, value) {
        document.querySelectorAll(selector).forEach((el) => {
            el.setAttribute('placeholder', value);
        });
    }

    function setNthText(selector, index, value) {
        const els = document.querySelectorAll(selector);
        if (els[index]) els[index].textContent = value;
    }

    function setHeaderTextWithAction(containerSelector, actionSelector, mainText, actionText) {
        const container = document.querySelector(containerSelector);
        const action = document.querySelector(actionSelector);
        if (!container || !action) return;

        const textNode = Array.from(container.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
        if (textNode) {
            textNode.textContent = `${mainText} `;
        } else {
            container.insertBefore(document.createTextNode(`${mainText} `), container.firstChild);
        }
        action.textContent = actionText;
    }

    const TEXT_PATH_MAP = new Map();

    function normalizeTextKey(value) {
        return String(value || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function buildTextPathMap(node, path = '') {
        if (!node || typeof node !== 'object') return;

        Object.entries(node).forEach(([key, value]) => {
            const nextPath = path ? `${path}.${key}` : key;

            if (value && typeof value === 'object' && !Array.isArray(value)) {
                buildTextPathMap(value, nextPath);
                return;
            }

            if (typeof value !== 'string') return;

            const normalized = normalizeTextKey(value);
            if (normalized && !TEXT_PATH_MAP.has(normalized)) {
                TEXT_PATH_MAP.set(normalized, nextPath);
            }
        });
    }

    Object.values(resources).forEach((langPack) => {
        buildTextPathMap(langPack?.translation || {});
    });

    function t(key, options = {}) {
        if (!window.i18next) return key;
        return window.i18next.t(key, options);
    }

    function tText(text, options = {}) {
        if (!window.i18next) return text;

        const raw = String(text || '');
        const normalized = normalizeTextKey(raw);
        if (!normalized) return raw;

        if (window.i18next.exists(raw)) {
            return window.i18next.t(raw, options);
        }

        const mappedPath = TEXT_PATH_MAP.get(normalized);
        if (mappedPath && window.i18next.exists(mappedPath)) {
            return window.i18next.t(mappedPath, options);
        }

        return raw;
    }

    function translateApplyPage() {
        if (!document.getElementById('yh-scroll-auth')) return;

        document.title = t('pages.applyTitle');
        setText('#toast-message', t('common.notification'));

        setText('.yh-landing-brand-name', t('apply.brand'));
        setText('#yh-scroll-auth', t('apply.topEnter'));
        setText('.yh-landing-pill', t('apply.heroPill'));
        setText('.yh-landing-title', t('apply.heroTitle'));
        setText('.yh-landing-narrative', t('apply.heroNarrative'));
        setText('.yh-landing-subtitle', t('apply.heroSubtitle'));
        setText('#yh-open-auth-main', t('apply.heroPrimary'));
        setText('.yh-landing-cta-note', t('apply.heroNote'));
        setText('#yh-scroll-divisions', t('apply.heroSecondary'));
        setNthText('.yh-landing-proof-item', 0, t('apply.proof1'));
        setNthText('.yh-landing-proof-item', 1, t('apply.proof2'));
        setNthText('.yh-landing-proof-item', 2, t('apply.proof3'));
        setNthText('.yh-landing-metric-card span', 0, t('apply.liveNow'));
        setNthText('.yh-landing-metric-card span', 1, t('apply.comingSoon'));
        setNthText('.yh-landing-metric-card span', 2, t('apply.comingSoon'));
        setNthText('.yh-landing-scroll-hint span', 0, t('apply.scrollHint'));
        setText('.yh-landing-visual-kicker', t('apply.previewKicker'));
        setText('.yh-landing-visual-caption strong', t('apply.previewStrong'));
        setText('.yh-landing-section-kicker', t('apply.sectionDivisionsKicker'));
        setText('.yh-landing-section-title', t('apply.sectionDivisionsTitle'));
        setText('.yh-landing-section-copy', t('apply.sectionDivisionsCopy'));

        const divisionCards = document.querySelectorAll('.yh-landing-division-card');
        if (divisionCards[0]) {
            divisionCards[0].querySelector('h3').textContent = t('apply.academyCardTitle');
            divisionCards[0].querySelector('p').textContent = t('apply.academyCardCopy');
            const items = divisionCards[0].querySelectorAll('li');
            if (items[0]) items[0].textContent = t('apply.academyFeat1');
            if (items[1]) items[1].textContent = t('apply.academyFeat2');
            if (items[2]) items[2].textContent = t('apply.academyFeat3');
            if (items[3]) items[3].textContent = t('apply.academyFeat4');
            const btn = divisionCards[0].querySelector('button');
            if (btn) btn.textContent = t('apply.academyBtn');
        }

        if (divisionCards[1]) {
            divisionCards[1].querySelector('h3').textContent = t('apply.plazasCardTitle');
            divisionCards[1].querySelector('p').textContent = t('apply.plazasCardCopy');
            const items = divisionCards[1].querySelectorAll('li');
            if (items[0]) items[0].textContent = t('apply.plazasFeat1');
            if (items[1]) items[1].textContent = t('apply.plazasFeat2');
            if (items[2]) items[2].textContent = t('apply.plazasFeat3');
            if (items[3]) items[3].textContent = t('apply.plazasFeat4');
        }

        if (divisionCards[2]) {
            divisionCards[2].querySelector('h3').textContent = t('apply.federationCardTitle');
            divisionCards[2].querySelector('p').textContent = t('apply.federationCardCopy');
            const items = divisionCards[2].querySelectorAll('li');
            if (items[0]) items[0].textContent = t('apply.federationFeat1');
            if (items[1]) items[1].textContent = t('apply.federationFeat2');
            if (items[2]) items[2].textContent = t('apply.federationFeat3');
            if (items[3]) items[3].textContent = t('apply.federationFeat4');
        }

        const previewCards = document.querySelectorAll('.yh-dashboard-preview-card');
        setNthText('.yh-landing-dashboard-preview .yh-landing-section-kicker', 0, t('apply.dashboardHighlightsKicker'));
        setNthText('.yh-landing-dashboard-preview .yh-landing-section-title', 0, t('apply.dashboardHighlightsTitle'));

        if (previewCards[0]) {
            previewCards[0].querySelector('h4').textContent = t('apply.preview1Title');
            previewCards[0].querySelector('p').textContent = t('apply.preview1Copy');
        }
        if (previewCards[1]) {
            previewCards[1].querySelector('h4').textContent = t('apply.preview2Title');
            previewCards[1].querySelector('p').textContent = t('apply.preview2Copy');
        }
        if (previewCards[2]) {
            previewCards[2].querySelector('h4').textContent = t('apply.preview3Title');
            previewCards[2].querySelector('p').textContent = t('apply.preview3Copy');
        }
        if (previewCards[3]) {
            previewCards[3].querySelector('h4').textContent = t('apply.preview4Title');
            previewCards[3].querySelector('p').textContent = t('apply.preview4Copy');
        }

        setPlaceholder('#login-email', t('auth.emailAddress'));
        setPlaceholder('#login-password', t('auth.password'));
        setText('.forgot-link', t('auth.forgotPassword'));
        setText('#btn-login', t('auth.login'));
        setText('#btn-flip-login', t('auth.backToLogin'));

        const registerLabels = document.querySelectorAll('#form-register-simple label');
        if (registerLabels[0]) registerLabels[0].textContent = t('auth.fullName');
        if (registerLabels[1]) registerLabels[1].textContent = t('auth.email');
        if (registerLabels[2]) registerLabels[2].textContent = t('auth.username');
        if (registerLabels[3]) registerLabels[3].textContent = 'Profile Photo';
        if (registerLabels[4]) registerLabels[4].textContent = t('auth.createPassword');
        if (registerLabels[5]) registerLabels[5].textContent = t('auth.confirmPassword');

        setPlaceholder('#reg-fullname', t('auth.egName'));
        setPlaceholder('#reg-email', t('auth.egEmail'));
        setPlaceholder('#reg-username', t('auth.chooseUsername'));
        setPlaceholder('#reg-password', '••••••••');
        setPlaceholder('#reg-confirm-password', '••••••••');
        setText('#reg-profile-photo-label', t('auth.choosePhoto'));
        setText('#btn-register', t('auth.createAccount'));

        setText('#step-2 .yh-title-small', t('auth.verifyIdentity'));
        setPlaceholder('#otp-input', '••••••');
        setText('#btn-verify-otp', t('auth.verifyEnter'));
        if (document.getElementById('btn-resend-otp') && !document.getElementById('btn-resend-otp').disabled) {
            setText('#btn-resend-otp', t('auth.resendCode'));
        }

        setText('#step-3 h2', t('auth.resetPassword'));
        setPlaceholder('#forgot-email-input', t('auth.egEmail'));
        setText('#btn-forgot-send', t('auth.sendRecoveryCode'));
        setText('#step-3 .btn-secondary', t('auth.cancelBack'));

        setText('#step-4 h2', t('auth.verifyResetCode'));
        setPlaceholder('#forgot-otp-code', '••••••');
        setText('#btn-forgot-verify', t('auth.verifyCode'));

        setText('#step-5 h2', t('auth.createNewPassword'));
        setPlaceholder('#reset-new-password', t('auth.newPassword'));
        setPlaceholder('#reset-confirm-password', t('auth.confirmNewPassword'));
        setText('#btn-reset-save', t('auth.saveNewPassword'));

        setText('#step-6 h2', t('auth.passwordChanged'));
        setText('#step-6 p', t('auth.passwordChangedCopy'));
        setText('#step-6 .btn-primary', t('auth.backLoginCta'));

        document.querySelectorAll('.yh-landing-status').forEach((el) => {
            const raw = String(el.textContent || '').trim();
            if (raw) el.textContent = tText(raw);
        });

        document.querySelectorAll('.yh-coming-soon-btn').forEach((el) => {
            const raw = String(el.textContent || '').trim();
            if (raw) el.textContent = tText(raw);
        });
    }

    function translateDashboardPage() {
        if (!document.querySelector('.dashboard-layout')) return;

        document.title = t('pages.dashboardTitle');
        setText('#toast-message', t('common.notification'));
        setText('.btn-logout', t('dashboard.logout'));

        setHeaderTextWithAction('.notif-header', '#mark-all-read', t('dashboard.notifications'), t('dashboard.markAllRead'));
        setText('#notif-empty-state', t('dashboard.noNotifications'));

        setText('.yh-resources-menu-label-desktop', t('dashboard.resourcesDesktop'));
        setText('.yh-resources-menu-label-mobile', t('dashboard.resourcesMobile'));
        setText('.yh-resources-menu-kicker', t('dashboard.quickAccess'));
        setText('.yh-resources-menu-title-desktop', t('dashboard.resourcesDesktop'));
        setText('.yh-resources-menu-title-mobile', t('dashboard.resourcesMobile'));

        setText('.yh-universe-kicker', t('dashboard.universeKicker'));
        setText('.yh-universe-title', t('dashboard.universeTitle'));

        const portalMeta = document.querySelectorAll('.yh-universe-meta-copy');
        if (portalMeta[0]) portalMeta[0].textContent = t('dashboard.academyMeta');

        const portalTitles = document.querySelectorAll('.portal-title');
        if (portalTitles[0]) portalTitles[0].textContent = t('dashboard.academyTitle');

        const portalDescs = document.querySelectorAll('.portal-desc');
        if (portalDescs[0]) portalDescs[0].textContent = t('dashboard.academyDesc');

        const btnLabels = document.querySelectorAll('.yh-btn-label');
        if (btnLabels[0]) btnLabels[0].textContent = t('dashboard.academyBtn');

        setText('#ai-verdict-title', tText(document.getElementById('ai-verdict-title')?.textContent || ''));
        setText('#ai-verdict-desc', tText(document.getElementById('ai-verdict-desc')?.textContent || ''));
        setText('#btn-enter-academy-chat', t('dashboard.openAcademy'));

        setText('.academy-member-browser-kicker', t('dashboard.academyDirectory'));
        setText('.academy-member-browser-title', t('dashboard.otherHustlers'));
        setText('.academy-member-browser-copy', t('dashboard.otherHustlersCopy'));
        setText('.academy-member-browser-empty', t('dashboard.loadingMembers'));

        document.querySelectorAll(
            '.yh-resource-mini-eyebrow, ' +
            '.yh-resource-mini-status, ' +
            '.yh-resource-mini-copy, ' +
            '.yh-featured-sites-eyebrow, ' +
            '.yh-featured-sites-text, ' +
            '.yh-universe-feature-kicker, ' +
            '.yh-universe-feature-title, ' +
            '.yh-universe-feature-chip'
        ).forEach((el) => {
            const raw = String(el.textContent || '').trim();
            if (raw) el.textContent = tText(raw);
        });

        const proofWork = document.getElementById('app-proof-work');
        if (proofWork?.previousElementSibling) {
            proofWork.previousElementSibling.textContent = tText(String(proofWork.previousElementSibling.textContent || '').trim());
        }
        if (proofWork) proofWork.placeholder = tText(proofWork.getAttribute('placeholder') || '');

        const sacrifice = document.getElementById('app-sacrifice');
        if (sacrifice?.previousElementSibling) {
            sacrifice.previousElementSibling.textContent = tText(String(sacrifice.previousElementSibling.textContent || '').trim());
        }
        if (sacrifice) sacrifice.placeholder = tText(sacrifice.getAttribute('placeholder') || '');

        const seriousness = document.getElementById('app-seriousness');
        if (seriousness?.previousElementSibling) {
            seriousness.previousElementSibling.textContent = tText(String(seriousness.previousElementSibling.textContent || '').trim());
        }
        if (seriousness) {
            Array.from(seriousness.options).forEach((opt) => {
                opt.textContent = tText(String(opt.textContent || '').trim());
            });
        }

        const hours = document.getElementById('app-hours');
        if (hours?.previousElementSibling) {
            hours.previousElementSibling.textContent = tText(String(hours.previousElementSibling.textContent || '').trim());
        }
        if (hours) {
            Array.from(hours.options).forEach((opt) => {
                opt.textContent = tText(String(opt.textContent || '').trim());
            });
        }

        const nonnegotiable = document.getElementById('app-nonnegotiable');
        if (nonnegotiable?.previousElementSibling) {
            nonnegotiable.previousElementSibling.textContent = tText(String(nonnegotiable.previousElementSibling.textContent || '').trim());
        }
        if (nonnegotiable) nonnegotiable.placeholder = tText(nonnegotiable.getAttribute('placeholder') || '');

        const adminNote = document.getElementById('app-admin-note');
        if (adminNote?.previousElementSibling) {
            adminNote.previousElementSibling.textContent = tText(String(adminNote.previousElementSibling.textContent || '').trim());
        }
        if (adminNote) adminNote.placeholder = tText(adminNote.getAttribute('placeholder') || '');

        const submitAiBtn = document.getElementById('btn-submit-ai');
        if (submitAiBtn) submitAiBtn.textContent = tText(String(submitAiBtn.textContent || '').trim());

        const spinnerHeading = document.querySelector('#ai-spinner-phase h3');
        if (spinnerHeading) spinnerHeading.textContent = tText(String(spinnerHeading.textContent || '').trim());

        const spinnerText = document.querySelector('#ai-spinner-phase p');
        if (spinnerText) spinnerText.textContent = tText(String(spinnerText.textContent || '').trim());
    }

    function translateCurrentPage() {
        translateApplyPage();
        translateDashboardPage();
    }

    async function setLanguage(lang) {
        const nextLang = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
        await window.i18next.changeLanguage(nextLang);
        try {
            localStorage.setItem(STORAGE_KEY, nextLang);
        } catch (_) {}

        document.documentElement.lang = nextLang;
        document.querySelectorAll('[data-yh-language-switcher]').forEach((el) => {
            el.value = nextLang;
        });

        translateCurrentPage();
        window.dispatchEvent(new CustomEvent('yh:languageChanged', { detail: { language: nextLang } }));
    }

    function bindLanguageSwitchers() {
        document.querySelectorAll('[data-yh-language-switcher]').forEach((el) => {
            if (el.dataset.boundLangSwitcher === 'true') return;
            el.dataset.boundLangSwitcher = 'true';
            el.value = getSavedLanguage();

            el.addEventListener('change', async (event) => {
                await setLanguage(event.target.value);
            });
        });
    }

    async function boot() {
        if (!window.i18next) {
            console.error('i18next is not loaded.');
            return;
        }

        const initialLang = getSavedLanguage();

        await window.i18next.init({
            lng: DEFAULT_LANG,
            fallbackLng: DEFAULT_LANG,
            supportedLngs: SUPPORTED_LANGS,
            resources,
            interpolation: { escapeValue: false },
            returnEmptyString: false
        });

        bindLanguageSwitchers();
        await setLanguage(initialLang);
                console.info('[YH i18n] booted', {
            version: window.__YH_I18N_VERSION,
            savedLanguage: initialLang,
            activeLanguage: window.i18next.language,
            supported: SUPPORTED_LANGS
        });
        window.__YH_I18N_VERSION = '2026-04-03-lang-fix';

        window.dispatchEvent(new CustomEvent('yh:i18n-ready', {
            detail: {
                language: window.i18next.language,
                version: window.__YH_I18N_VERSION
            }
        }));
    }

    window.YHI18n = {
        boot,
        setLanguage,
        translateCurrentPage,
        translateApplyPage,
        translateDashboardPage,
        getLanguage: () => window.i18next?.language || DEFAULT_LANG
    };

    window.yhT = t;
    window.yhTText = tText;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();