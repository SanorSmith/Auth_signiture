package com.authsignature.app.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.core.content.ContextCompat
import com.authsignature.app.container
import com.authsignature.app.data.ApiException
import com.authsignature.app.data.User
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private enum class Tab(val label: String, val icon: ImageVector) {
    Requests("Requests", Icons.Filled.Inbox),
    Scan("Scan", Icons.Filled.QrCodeScanner),
    Monitor("Monitor", Icons.Filled.Visibility),
    Counter("Colli counter", Icons.Filled.Inventory2),
    Users("Users", Icons.Filled.Group),
    Account("Account", Icons.Filled.Person),
}

/** Only the screens this person may use. */
private fun available(u: User) = buildList {
    if (u.can("manage_requests")) add(Tab.Requests)
    if (u.can("request")) add(Tab.Scan)
    if (u.can("monitor")) add(Tab.Monitor)
    if (u.can("colli_counter")) add(Tab.Counter)
    if (u.canManageUsers) add(Tab.Users)
    add(Tab.Account)
}

/** Which screen a notification points at. */
private fun tabFor(url: String) = when {
    url.startsWith("/admin/users") -> Tab.Users
    url.startsWith("/admin") -> Tab.Requests
    url.startsWith("/client") -> Tab.Scan
    url.startsWith("/monitor") -> Tab.Monitor
    url.startsWith("/counter") -> Tab.Counter
    else -> null
}

/** The signed-in app: a bar on top with the notification bell, the screens, and navigation along the bottom. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScaffold(user: User, openUrl: String?, onUrlHandled: () -> Unit) {
    val context = LocalContext.current
    val container = context.container
    val scope = rememberCoroutineScope()
    val tabs = available(user)
    var selectedName by rememberSaveable { mutableStateOf(tabs.first().name) }
    val selected = tabs.firstOrNull { it.name == selectedName } ?: tabs.first()
    var showNotifications by remember { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }
    val unread by container.poller.unread.collectAsState()

    // Android 13+ asks before an app may show notifications.
    // Phones stop apps that run quietly with the screen off; ask once to leave this one alone.
    val askBattery = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) {}
    fun startBackground() {
        if (!container.store.backgroundAlerts) return
        com.authsignature.app.notify.AlertService.start(context)
        if (!container.store.askedAboutBackground) {
            container.store.askedAboutBackground = true
            val power = context.getSystemService(android.content.Context.POWER_SERVICE) as android.os.PowerManager
            if (!power.isIgnoringBatteryOptimizations(context.packageName)) {
                runCatching {
                    askBattery.launch(
                        android.content.Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                            .setData(android.net.Uri.parse("package:" + context.packageName)),
                    )
                }
            }
        }
    }
    val askNotifications = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { startBackground() }
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) startBackground()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            startBackground()
        }
    }

    // What a person may do can change while the app is open (an admin edits it), so keep it fresh.
    LaunchedEffect(Unit) {
        while (true) {
            try {
                container.refreshUser()
            } catch (e: ApiException) {
                if (e.unauthorized) container.signOut()
            } catch (_: Exception) {
            }
            delay(30_000)
        }
    }

    // A notification arrives while the app is open: its tone, and a banner that opens the right screen.
    LaunchedEffect(Unit) {
        container.poller.events.collect { notice ->
            // One sound: the app plays its own tone while it is open. The phone's notification sound is only for when it is closed.
            container.signalFor(notice)
            scope.launch {
                val result = snackbar.showSnackbar(
                    message = "${notice.title}\n${notice.body}",
                    actionLabel = com.authsignature.app.i18n.t("View"),
                    withDismissAction = true,
                    duration = SnackbarDuration.Long,
                )
                if (result == SnackbarResult.ActionPerformed) tabFor(notice.url)?.takeIf { it in tabs }?.let { selectedName = it.name }
            }
        }
    }

    // Tapping a system notification opens the screen it is about.
    LaunchedEffect(openUrl) {
        if (openUrl != null) {
            tabFor(openUrl)?.takeIf { it in tabs }?.let { selectedName = it.name }
            onUrlHandled()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(selected.label, fontWeight = FontWeight.SemiBold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
                actions = {
                    IconButton(onClick = { showNotifications = true }) {
                        BadgedBox(badge = { if (unread > 0) Badge { Text(if (unread > 9) "9+" else unread.toString()) } }) {
                            Icon(Icons.Filled.Notifications, contentDescription = com.authsignature.app.i18n.t("Notifications"))
                        }
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                tabs.forEach { tab ->
                    NavigationBarItem(
                        selected = tab == selected,
                        onClick = { selectedName = tab.name },
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
        snackbarHost = { SnackbarHost(snackbar) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (selected) {
                Tab.Requests -> AdminScreen()
                Tab.Scan -> ClientScreen()
                Tab.Monitor -> MonitorScreen()
                Tab.Counter -> CounterTab(isAdmin = user.isAdmin)
                Tab.Users -> UsersScreen()
                Tab.Account -> AccountScreen(user)
            }
        }
    }

    if (showNotifications) {
        NotificationsSheet(
            onDismiss = { showNotifications = false },
            onOpen = { url ->
                showNotifications = false
                tabFor(url)?.takeIf { it in tabs }?.let { selectedName = it.name }
            },
        )
    }
}
