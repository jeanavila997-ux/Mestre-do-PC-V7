# Mestre do PC V8 — Testes PowerShell
# Execute com: Invoke-Pester

BeforeAll {
    $projectPath = Resolve-Path "$PSScriptRoot\..\.."
    Import-Module "$projectPath\src\security\SecurityConfig.psm1" -Force
    Import-Module "$projectPath\src\launcher\Logger.psm1" -Force
    Import-Module "$projectPath\src\launcher\JobManager.psm1" -Force
}

Describe "SecurityConfig" {
    BeforeAll {
        Initialize-SecurityConfig -Config @{ port = 7777 }
    }

    It "Deve permitir Get-Process" {
        $r = Test-SafeCommand -Command "Get-Process"
        $r.IsSafe | Should -Be $true
    }

    It "Deve bloquear Invoke-Expression" {
        $r = Test-SafeCommand -Command "Invoke-Expression evil"
        $r.IsSafe | Should -Be $false
        $r.Category | Should -Be "dangerous_pattern"
    }

    It "Deve bloquear comando nao permitido" {
        $r = Test-SafeCommand -Command "Format-Volume C:"
        $r.IsSafe | Should -Be $false
        $r.Category | Should -Be "not_allowed"
    }

    It "Deve bloquear comando vazio" {
        $r = Test-SafeCommand -Command ""
        $r.IsSafe | Should -Be $false
    }

    It "Deve permitir git status" {
        $r = Test-SafeCommand -Command "git status"
        $r.IsSafe | Should -Be $true
    }
}

Describe "Logger" {
    BeforeAll {
        $testLogDir = "$env:TEMP\mpc-v8-tests"
        if (Test-Path $testLogDir) { Remove-Item $testLogDir -Recurse -Force }
        Initialize-Logger -LogDirectory $testLogDir
    }

    It "Deve criar arquivo de log" {
        Write-Log -Level INFO -Message "Teste de log" -Source "Test"
        $files = Get-ChildItem $testLogDir -Filter "*.log"
        $files.Count | Should -BeGreaterThan 0
    }

    It "Deve registrar JSON valido" {
        $logFile = Get-ChildItem $testLogDir -Filter "*.log" | Select-Object -First 1
        $line = Get-Content $logFile -Raw | ConvertFrom-Json
        $line.level | Should -Be "INFO"
        $line.message | Should -Be "Teste de log"
    }
}

Describe "JobManager" {
    BeforeAll {
        Initialize-JobManager -MinRunspaces 1 -MaxRunspaces 2
    }

    AfterAll {
        Stop-JobManager
    }

    It "Deve criar job e retornar GUID" {
        $job = New-CommandJob -CommandText "Get-Date" -TimeoutSeconds 5
        $job.Id | Should -Match '^[a-f0-9]{32}$'
        $job.State | Should -Be "running"
    }

    It "Deve completar job com sucesso" {
        $job = New-CommandJob -CommandText "Get-Date" -TimeoutSeconds 5
        Start-Sleep -Seconds 2
        $result = Get-CommandJob -JobId $job.Id
        $result.State | Should -Be "completed"
        $result.Success | Should -Be $true
    }

    It "Deve contar jobs ativos" {
        $before = Get-ActiveJobCount
        $j = New-CommandJob -CommandText "Start-Sleep 2" -TimeoutSeconds 5
        Get-ActiveJobCount | Should -Be ($before + 1)
        # Aguardar completar para nao poluir proximos testes
        Start-Sleep -Seconds 3
        Get-CommandJob -JobId $j.Id | Out-Null
    }

    It "Deve retornar null para job inexistente" {
        $r = Get-CommandJob -JobId "inexistente"
        $r | Should -Be $null
    }
}
