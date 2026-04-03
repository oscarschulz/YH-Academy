(function () {
    const STORAGE_KEY = 'yh_lang';
    const DEFAULT_LANG = 'en';
    const SUPPORTED_LANGS = ['en', 'es', 'fil'];

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

        fil: {
            translation: {
                pages: {
                    applyTitle: 'YH Universe',
                    dashboardTitle: 'Dashboard | YH Universe'
                },
                common: {
                    notification: 'Abiso',
                    language: 'Wika'
                },
                apply: {
                    brand: 'Young Hustlers Universe',
                    topEnter: 'Pumasok sa Universe ➔',
                    heroPill: 'Pandaigdigang structured network',
                    heroTitle: 'Young Hustlers Universe',
                    heroNarrative: 'Hindi lang ito basta komunidad. Isa itong sistema para sa direksyon, istruktura, at expansion.',
                    heroSubtitle: 'Isang universe. Maraming divisions. Buoin ang roadmap mo, pumasok sa Academy, at maghanda sa pag-angat ng Plazas at Federation.',
                    heroPrimary: 'I-access ang Academy ➔',
                    heroNote: 'Simulan ang roadmap mo sa loob ng wala pang 60 segundo',
                    heroSecondary: 'Tingnan ang divisions',
                    proof1: '✔ Structured growth system',
                    proof2: '✔ Live execution environment',
                    proof3: '✔ Expansion-ready universe',
                    liveNow: 'Live na',
                    comingSoon: 'Malapit na',
                    scrollHint: 'Mag-scroll para mag-explore',
                    previewKicker: 'Universe Preview',
                    previewStrong: 'Roadmaps. Community. Live execution.',
                    sectionDivisionsKicker: 'Universe Divisions',
                    sectionDivisionsTitle: 'Lahat ng nasa dashboard, ipinakilala sa isang page',
                    sectionDivisionsCopy: 'Ang dashboard ay nakaayos sa live execution, mga susunod na monetization systems, at future strategic expansion.',
                    academyCardTitle: 'YH Academy',
                    academyCardCopy: 'Buoin ang roadmap mo gamit ang AI-guided missions, pumasok sa community, i-track ang execution, at sumali sa live sessions.',
                    academyFeat1: 'AI roadmap generation',
                    academyFeat2: 'Mission at execution system',
                    academyFeat3: 'Community feed at comments',
                    academyFeat4: 'Live division entry',
                    academyBtn: 'Pumasok sa YH Academy ➔',
                    plazasCardTitle: 'The Plazas',
                    plazasCardCopy: 'Ang marketplace layer ng universe. Dito ilalagay ang skills, services, offers, talent, at monetization pathways.',
                    plazasFeat1: 'Marketplace at services',
                    plazasFeat2: 'Talent at offers',
                    plazasFeat3: 'Patron-led monetization',
                    plazasFeat4: 'Expansion-ready infrastructure',
                    federationCardTitle: 'The Federation',
                    federationCardCopy: 'Ang strategic network layer. Dito pamamahalaan ang high-value contacts, global leverage, at long-term relationship capital.',
                    federationFeat1: 'High-value network directory',
                    federationFeat2: 'Strategic relationship mapping',
                    federationFeat3: 'Global leverage layer',
                    federationFeat4: 'Elite expansion system',
                    dashboardHighlightsKicker: 'Dashboard Highlights',
                    dashboardHighlightsTitle: 'Ano ang maa-unlock ng users sa loob ng universe',
                    preview1Title: 'Universe Hub',
                    preview1Copy: 'Lumipat sa iba’t ibang divisions mula sa iisang command layer.',
                    preview2Title: 'Academy Roadmaps',
                    preview2Copy: 'AI-built execution plans base sa goals, blockers, at seriousness.',
                    preview3Title: 'Community Layer',
                    preview3Copy: 'Mag-post ng updates, makipag-engage, mag-comment, at bumuo ng momentum kasama ang iba.',
                    preview4Title: 'Future Expansion',
                    preview4Copy: 'Nakaposisyon na ang Plazas at Federation bilang next layers.'
                },
                auth: {
                    emailAddress: 'Email Address',
                    password: 'Password',
                    forgotPassword: 'Nakalimutan ang password?',
                    login: 'Login',
                    backToLogin: '⬅ Bumalik sa Login',
                    fullName: 'Buong Pangalan',
                    email: 'Email',
                    username: 'Username',
                    createPassword: 'Gumawa ng Password',
                    confirmPassword: 'Kumpirmahin ang Password',
                    createAccount: 'Gumawa ng Account ➔',
                    verifyIdentity: 'I-verify ang Iyong Identity',
                    verifyEnter: 'I-verify at Pumasok sa Universe ➔',
                    resendCode: 'I-resend ang Code',
                    resetPassword: 'I-reset ang Password',
                    cancelBack: 'Cancel at Bumalik sa Login',
                    sendRecoveryCode: 'Magpadala ng Recovery Code',
                    verifyResetCode: 'I-verify ang Reset Code',
                    verifyCode: 'I-verify ang Code',
                    createNewPassword: 'Gumawa ng Bagong Password',
                    newPassword: 'Bagong Password',
                    confirmNewPassword: 'Kumpirmahin ang Bagong Password',
                    saveNewPassword: 'I-save ang Bagong Password ➔',
                    passwordChanged: 'Nabago na ang Password!',
                    passwordChangedCopy: 'Matagumpay na na-update ang iyong password.',
                    backLoginCta: 'Bumalik sa Login ➔',
                    egName: 'hal. John Doe',
                    egEmail: 'you@email.com',
                    chooseUsername: 'Pumili ng username',
                    choosePhoto: 'Pumili ng profile photo',
                    show: 'Show',
                    hide: 'Hide',
                    loading: 'Naglo-load...',
                    creatingAccount: 'Gumagawa ng account...',
                    sending: 'Nagpapadala...',
                    verifying: 'Nagve-verify...',
                    saving: 'Nagse-save...',
                    resendIn: 'Resend sa loob ng {{time}}'
                },
                dashboard: {
                    logout: '⎋ Mag-log out',
                    notifications: 'Mga notification',
                    markAllRead: 'Mark all as read',
                    noNotifications: 'Wala pang notifications.',
                    resourcesDesktop: 'Partnerships at Resources',
                    resourcesMobile: 'Featured sites',
                    quickAccess: 'Quick Access',
                    universeKicker: 'YH Universe Navigator',
                    universeTitle: 'YH UNIVERSE',
                    liveDivision: 'Live Division',
                    academyMeta: 'Roadmaps, execution, community, live sessions',
                    academyTitle: 'The Academy',
                    academyDesc: 'Pumasok sa self-improvement division ng YH Universe. Buoin ang roadmap mo gamit ang AI-guided missions, sumali sa community, at pumasok sa live voice sessions.',
                    academyBtn: 'Mag-apply sa Academy ➔',
                    chatWelcomeTopic: 'Welcome sa Academy Universe',
                    chatPlaceholderCommunity: 'Message 💬 {{room}}.',
                    chatTopicGroup: 'Private Brainstorming Group',
                    chatTopicDm: 'Direct Message',
                    chatPlaceholderRoom: 'Message {{room}}.',
                    missionUpdateTitle: 'I-update ang Mission',
                    missionUpdateContext: 'Magdagdag ng maikling note bago i-update ang mission na ito.',
                    missionNote: 'Note',
                    missionNotePlaceholder: 'Magsulat ng maikling note...',
                    missionSaveUpdate: 'I-save ang Update',
                    missionSkipTitle: 'I-skip ang Mission',
                    missionSkipContext: 'Bakit mo isi-skip ang "{{title}}" ngayong araw?',
                    missionSkipFallback: 'ang mission na ito',
                    missionSkipLabel: 'Dahilan ng pag-skip',
                    missionSkipPlaceholder: 'Bakit mo isi-skip ang mission na ito ngayon?',
                    missionSkipBtn: 'Mark as Skipped',
                    missionStuckTitle: 'Markahan ang Mission bilang Stuck',
                    missionStuckContext: 'Ano mismo ang humaharang sa progress sa "{{title}}"?',
                    missionStuckLabel: 'Saan ka na-stuck?',
                    missionStuckPlaceholder: 'Ilarawan nang malinaw ang blocker...',
                    missionStuckBtn: 'Mark as Stuck',
                    saving: 'Nagse-save...',
                    saveCheckin: 'I-save ang Check-In',
                    roadmapCreating: 'Gumagawa ng Roadmap...',
                    roadmapSubmit: 'Isumite ang Roadmap Request ➔',
                    openAcademy: 'Buksan ang YH Academy ➔',
                    academyDirectory: 'Academy Directory',
                    otherHustlers: 'Tingnan ang ibang Hustlers',
                    otherHustlersCopy: 'I-browse ang members mula sa database at i-follow sila mula rito.',
                    loadingMembers: 'Naglo-load ng members...',
                    stateApproved: 'Naaprubahan ang Academy Access',
                    stateWaitlisted: 'Na-waitlist ang Academy application mo',
                    stateReviewed: 'Na-review na ang Academy application mo',
                    stateLocked: 'Locked',
                    stateUnlocked: 'Unlocked',
                    statePending: 'Pending Review',
                    stateApply: 'Mag-apply para sa Access'
                },

                'Please choose an image file.': 'Pumili ng image file.',
                'Please enter your email/username and password.': 'Ilagay ang iyong email o username at password.',
                'Server error during login.': 'May server error habang nagla-login.',
                'Passwords do not match.': 'Hindi magkatugma ang mga password.',
                'Please enter a username.': 'Maglagay ng username.',
                'Profile photo is required.': 'Kailangan ang profile photo.',
                'Please upload a valid image file.': 'Mag-upload ng valid image file.',
                'Missing verification email. Please register again.': 'Kulang ang verification email. Mag-register muli.',
                'A new code has been sent to your email.': 'Naipadala na ang bagong code sa iyong email.',
                'Failed to resend code.': 'Hindi na-resend ang code.',
                'Account verified. Welcome to YH Universe.': 'Verified na ang account. Welcome sa YH Universe.',
                'Server error during verification.': 'May server error habang nagve-verify.',
                'Server error.': 'May server error.',
                '{{division}} is coming soon to Young Hustlers Universe.': '{{division}} ay malapit nang dumating sa Young Hustlers Universe.',
                'Registration successful! Check your email for the verification code.': 'Matagumpay ang registration! Tingnan ang email mo para sa verification code.',
                'Email is already registered.': 'Naka-register na ang email na ito.',
                'Invalid verification code.': 'Invalid ang verification code.',
                'Email verified successfully!': 'Matagumpay na na-verify ang email!',
                'User not found.': 'Hindi nahanap ang user.',
                'Account is already verified.': 'Verified na ang account na ito.',
                'Invalid email/username or password.': 'Invalid ang email, username, o password.',
                'Account not verified. Please check your email and enter your OTP code first.': 'Hindi pa verified ang account. Tingnan ang email mo at ilagay muna ang OTP code.',
                'Login successful!': 'Matagumpay ang login!',
                'Logged out successfully.': 'Matagumpay ang pag-log out.',
                'Email not found in our system.': 'Hindi nakita ang email sa system namin.',
                'Password reset code sent to your email.': 'Naipadala na ang password reset code sa iyong email.',
                'Invalid or expired reset code.': 'Invalid o expired ang reset code.',
                'Code verified! You can now create a new password.': 'Verified ang code! Maaari ka nang gumawa ng bagong password.',
                'Password successfully reset!': 'Matagumpay na na-reset ang password!',
                'Choose a room first.': 'Pumili muna ng room.',
                'All notifications marked as read.': 'Na-mark na bilang read ang lahat ng notifications.',
                'Your session expired. Please log in again.': 'Expired na ang session mo. Mag-login muli.',
                'Refreshing roadmap...': 'Nire-refresh ang roadmap...',
                'Roadmap refreshed.': 'Na-refresh ang roadmap.',
                'Mission action is missing required data.': 'Kulang ang required data ng mission action.',
                'Please add a short note before continuing.': 'Magdagdag muna ng maikling note bago magpatuloy.',
                'Please complete the required check-in fields.': 'Kumpletuhin ang required na check-in fields.',
                'Check-in saved.': 'Na-save ang check-in.',
                'Check-in failed.': 'Hindi na-save ang check-in.',
                'Your AI roadmap is ready.': 'Handa na ang AI roadmap mo.',
                'Academy approved. You can now enter.': 'Naaprubahan ang Academy. Maaari ka nang pumasok.',
                'Your Academy application is now waitlisted.': 'Na-waitlist na ang Academy application mo.',
                'Your Academy application has been reviewed.': 'Na-review na ang Academy application mo.',
                'Academy membership approved. Opening Community Feed.': 'Naaprubahan ang Academy membership. Binubuksan ang Community Feed.',
                'Your Academy application is already under review.': 'Under review na ang Academy application mo.',
                'Your Academy application is waitlisted. Contact admin for the next step.': 'Waitlisted ang Academy application mo. Makipag-ugnayan sa admin para sa susunod na step.',
                'Your Academy application has already been reviewed. Only admin can reopen it.': 'Na-review na ang Academy application mo. Admin lang ang puwedeng magbukas ulit nito.',
                'You already filled the Academy application. Please wait for admin review.': 'Nasagutan mo na ang Academy application. Hintayin ang admin review.',
                'Failed to load Academy home.': 'Hindi ma-load ang Academy home.'
            }
        }
    };

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

    function t(key, options = {}) {
        if (!window.i18next) return key;
        return window.i18next.t(key, options);
    }

    function tText(text, options = {}) {
        if (!window.i18next) return text;
        return window.i18next.exists(text) ? window.i18next.t(text, options) : text;
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
        if (registerLabels[3]) registerLabels[3].textContent = t('auth.createPassword');
        if (registerLabels[4]) registerLabels[4].textContent = t('auth.confirmPassword');

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

        await window.i18next.init({
            lng: getSavedLanguage(),
            fallbackLng: DEFAULT_LANG,
            supportedLngs: SUPPORTED_LANGS,
            resources,
            interpolation: { escapeValue: false },
            returnEmptyString: false
        });

        document.documentElement.lang = window.i18next.language;
        bindLanguageSwitchers();
        translateCurrentPage();

        window.dispatchEvent(new CustomEvent('yh:i18n-ready', {
            detail: { language: window.i18next.language }
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